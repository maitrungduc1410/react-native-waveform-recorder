import AVFoundation
import Foundation
import QuartzCore
import UIKit

/// Wraps `AVAudioRecorder` with periodic metering polled on a `CADisplayLink`,
/// and orchestrates a multi-segment recording timeline so the host view can
/// drop in and out of the preview state without losing audio (WhatsApp /
/// Messenger "continue recording" UX).
///
/// State diagram (recording-only — preview is owned by `WaveformRecorderViewImpl`):
///
///   idle ── start() ─▶ recording ── pause() ─▶ paused ── resume() ─▶ recording
///                          │                       │
///                          └──── stop() ────┐      └─ stop() ─▶ stopped (file finalized)
///                                            │
///                                            ▼
///                                         stopped
///
/// `enterPreview()` is requested by the view impl when transitioning from
/// `.paused` to `.preview`. It finalises the in-progress segment, returns
/// the finalized URL to the caller (along with the full segment list), and
/// resets the recorder to a *between-segments* idle state. `resume()` from
/// the preview state creates a fresh segment writer; `stopFinalize()`
/// concatenates everything we've recorded into a single output file.
///
/// All callbacks fire on the main thread.
final class AudioRecorderEngine {

    // MARK: - State

    enum State {
        case idle
        case recording
        case paused
        /// Between segments — recorder torn down, awaiting a follow-up
        /// `resume()` or `stopFinalize()` from the view impl.
        case betweenSegments
        case stopped
        case error
    }

    private(set) var state: State = .idle
    /// Cumulative recorded duration across all segments, including the
    /// in-progress one (excludes time spent paused / in preview).
    private(set) var durationMs: Int = 0
    /// Peak amplitude observed since the engine was last reset (0..1).
    private(set) var peakAmplitude: Float = 0

    // MARK: - Configuration

    var outputURL: URL?
    var sampleRate: Double = 44100
    var channels: Int = 1
    var bitrate: Int = 128_000
    var quality: AVAudioQuality = .high
    var maxDurationMs: Int = 0
    var meterUpdatesPerSecond: Int = 30

    /// dBFS threshold for silence detection. -160 (default) disables it.
    var silenceThresholdDb: Float = -160
    /// Minimum window of silence in ms before `onSilenceDetected` fires. 0
    /// disables silence detection.
    var silenceTimeoutMs: Int = 0
    /// When true, the engine auto-calls `stopFinalize()` once silence is
    /// detected. Otherwise the host decides what to do.
    var autoStopOnSilence: Bool = false

    /// v1.0 — when true and `outputFormat == "wav"`, the engine tails the
    /// active segment file and emits chunks via `onPcmChunk`. Other formats
    /// silently no-op so the host can leave this prop on.
    var enablePcmStream: Bool = false
    /// Target chunk duration in ms; the actual chunk size will be quantised
    /// to the underlying audio chunk granularity.
    var pcmChunkMs: Int = 200
    /// One of "m4a" | "aac" | "wav" | "opus". Drives the encoder settings,
    /// segment file extension, and final-file mime type. Defaults to "m4a".
    /// Opus requires iOS 11+; if it isn't available at runtime we fall back
    /// to m4a and fire `onError(..., "format-unsupported")`.
    var outputFormat: String = "m4a"

    // MARK: - Callbacks

    var onStateChange: (() -> Void)?
    /// (linearAmplitude in [0, 1], peakSoFar in [0, 1], averagePowerDb)
    var onMeter: ((Float, Float, Float) -> Void)?
    var onMaxDurationReached: (() -> Void)?
    var onPermissionDenied: (() -> Void)?
    var onError: ((String, String?) -> Void)?
    /// Fires once when the rolling dB level stays below `silenceThresholdDb`
    /// for at least `silenceTimeoutMs`. Payload is the elapsed silence
    /// window in ms (always >= silenceTimeoutMs).
    var onSilenceDetected: ((Int) -> Void)?
    /// (base64 chunk, sampleRate, channels, bytesPerSample, timestampMs).
    /// Fires while `enablePcmStream` is true on the WAV path.
    var onPcmChunk: ((String, Int, Int, Int, Int) -> Void)?
    /// Fires once after `stopFinalize()` completes with the final file URL.
    /// `peakAmplitude` and `amplitudeHistory` span all segments.
    var onComplete: ((_ uri: String,
                      _ durationMs: Int,
                      _ sizeBytes: Int,
                      _ mimeType: String,
                      _ peakAmplitude: Float,
                      _ amplitudeHistory: [Float]) -> Void)?

    // MARK: - Public read-only segment state

    /// Finalised segment URLs (in order). The currently-recording one is NOT
    /// included until `pauseAndFinalizeSegment` / `stopFinalize` runs.
    private(set) var segments: [URL] = []
    /// File currently being written by `AVAudioRecorder`, or `nil` if we're
    /// `betweenSegments` / `stopped` / `idle`.
    private(set) var currentSegmentURL: URL?

    // MARK: - Private

    private var recorder: AVAudioRecorder?
    private var meterDisplayLink: CADisplayLink?
    private var lastMeterTick: CFTimeInterval = 0
    private var segmentStartTime: CFTimeInterval = 0
    /// Background-thread timer used by the optional raw-PCM stream.
    private var pcmStreamTimer: DispatchSourceTimer?
    /// File handle held open at the active WAV segment for streaming
    /// reads. Closed when the timer stops.
    private var pcmStreamHandle: FileHandle?
    /// Current read offset into the WAV file. Starts at 44 to skip the
    /// canonical WAV header. Reset on every new segment.
    private var pcmStreamOffset: UInt64 = 44
    /// Timestamp of the most recent loud sample. Used by the silence
    /// detector to compute elapsed silence.
    private var lastLoudTime: CFTimeInterval = 0
    private var silenceFiredForThisWindow: Bool = false
    /// Duration in ms of *completed* segments only.
    private var completedSegmentsDurationMs: Int = 0
    /// Duration of the in-progress segment up to the latest pause.
    private var inProgressSegmentMs: Int = 0
    private var amplitudeHistory: [Float] = []

    // MARK: - Lifecycle

    init() {}

    deinit {
        stopMeterDisplayLink()
        recorder?.stop()
    }

    // MARK: - Permissions

    func requestPermission(_ completion: @escaping (Bool) -> Void) {
        if #available(iOS 17.0, *) {
            AVAudioApplication.requestRecordPermission { granted in
                DispatchQueue.main.async { completion(granted) }
            }
        } else {
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                DispatchQueue.main.async { completion(granted) }
            }
        }
    }

    var hasMicrophonePermission: Bool {
        if #available(iOS 17.0, *) {
            return AVAudioApplication.shared.recordPermission == .granted
        } else {
            return AVAudioSession.sharedInstance().recordPermission == .granted
        }
    }

    // MARK: - Recording API

    /// Begin recording into a fresh segment. From `.idle` / `.stopped`,
    /// resets the segment list; from `.paused`, delegates to `resume()`;
    /// from `.betweenSegments`, starts a new segment that will be appended
    /// to the existing list at the next `pauseAndFinalizeSegment` /
    /// `stopFinalize`.
    func start() {
        guard state != .recording else { return }

        if !hasMicrophonePermission {
            onPermissionDenied?()
            return
        }
        if state == .paused {
            resume()
            return
        }

        let isFreshSession = state == .idle || state == .stopped || state == .error
        if isFreshSession {
            segments.removeAll()
            completedSegmentsDurationMs = 0
            durationMs = 0
            peakAmplitude = 0
            amplitudeHistory.removeAll(keepingCapacity: true)
        }
        inProgressSegmentMs = 0

        do {
            try configureAudioSession()
        } catch {
            transition(to: .error)
            onError?("Failed to configure AVAudioSession: \(error.localizedDescription)", "session")
            return
        }

        let url = resolveSegmentURL(isFirstSegment: isFreshSession)
        let settings = recorderSettings()

        do {
            let rec = try AVAudioRecorder(url: url, settings: settings)
            rec.isMeteringEnabled = true
            // `record(forDuration:)` is only meaningful on a single-segment
            // recording. With multi-segment continue-record, we enforce the
            // limit ourselves in the meter tick across all segments.
            guard rec.prepareToRecord(), rec.record() else {
                transition(to: .error)
                onError?("AVAudioRecorder.record() returned false", "start")
                return
            }
            recorder = rec
            currentSegmentURL = url
            segmentStartTime = CACurrentMediaTime()
            transition(to: .recording)
            startMeterDisplayLink()
            startPcmStreamTimerIfNeeded()
        } catch {
            transition(to: .error)
            onError?("Failed to create AVAudioRecorder: \(error.localizedDescription)", "start")
        }
    }

    func pause() {
        guard state == .recording, let rec = recorder else { return }
        rec.pause()
        inProgressSegmentMs = segmentDurationMs()
        durationMs = completedSegmentsDurationMs + inProgressSegmentMs
        stopMeterDisplayLink()
        stopPcmStreamTimer()
        transition(to: .paused)
    }

    func resume() {
        if state == .paused, let rec = recorder {
            guard rec.record() else {
                transition(to: .error)
                onError?("AVAudioRecorder.record() failed to resume", "resume")
                return
            }
            segmentStartTime = CACurrentMediaTime()
            transition(to: .recording)
            startMeterDisplayLink()
            startPcmStreamTimerIfNeeded()
            return
        }
        // From `.betweenSegments` (post-preview, post-exit) — kick off a
        // fresh segment that the view impl will append to the existing
        // `segments` list at the next pause/stop.
        if state == .betweenSegments {
            start()
        }
    }

    /// Finalise the in-progress segment and append it to `segments`. Leaves
    /// the engine in `.betweenSegments`. Returns the finalised URL.
    @discardableResult
    func pauseAndFinalizeSegment() -> URL? {
        // Must be either .paused or .recording (we'll auto-pause).
        if state == .recording {
            pause()
        }
        guard state == .paused, let rec = recorder, let url = currentSegmentURL else {
            return nil
        }
        completedSegmentsDurationMs += inProgressSegmentMs
        durationMs = completedSegmentsDurationMs
        inProgressSegmentMs = 0
        rec.stop()
        recorder = nil
        currentSegmentURL = nil
        segments.append(url)
        transition(to: .betweenSegments)
        return url
    }

    /// Finalise everything, concatenate segments if needed, and fire
    /// `onComplete` once the file is written. From `.betweenSegments` the
    /// concatenation happens immediately; from `.recording` / `.paused` we
    /// finalise the in-progress segment first.
    func stopFinalize() {
        if state == .recording || state == .paused {
            pauseAndFinalizeSegment()
        }
        // We're now in .betweenSegments OR there was nothing to record.
        if segments.isEmpty {
            // Nothing recorded — emit a zero-duration completion so JS can
            // still react (mirrors Android's "stop with empty file" path).
            transition(to: .stopped)
            return
        }
        finalizeAndEmit()
        deactivateSession()
    }

    /// Discard the entire session and reset to `.idle`. Deletes all segment
    /// files (including the in-progress one).
    func cancel() {
        stopMeterDisplayLink()
        stopPcmStreamTimer()
        let inProgress = currentSegmentURL
        recorder?.stop()
        recorder = nil
        currentSegmentURL = nil
        for url in segments {
            try? FileManager.default.removeItem(at: url)
        }
        if let inProgress = inProgress {
            try? FileManager.default.removeItem(at: inProgress)
        }
        segments.removeAll()
        completedSegmentsDurationMs = 0
        inProgressSegmentMs = 0
        durationMs = 0
        peakAmplitude = 0
        amplitudeHistory.removeAll(keepingCapacity: true)
        transition(to: .idle)
        deactivateSession()
    }

    func reset() {
        cancel()
    }

    // MARK: - Helpers

    /// Snapshot used by the view impl when entering preview. Returns the URL
    /// suitable for playback (single segment when there's one, an async
    /// concatenation otherwise). `completion` fires on main.
    func snapshotForPreview(completion: @escaping (URL?, String?) -> Void) {
        if segments.count == 1, let url = segments.first {
            completion(url, nil)
            return
        }
        if segments.isEmpty {
            completion(nil, "No segments to preview")
            return
        }
        concatenateSegments(segments) { result in
            switch result {
            case .success(let url):
                completion(url, nil)
            case .failure(let err):
                completion(nil, err.localizedDescription)
            }
        }
    }

    /// Public snapshot of the amplitude history for the view to render in
    /// the preview state. The view's bars view doesn't need the original
    /// audio data — only the per-tick amplitudes we already track.
    var amplitudeHistorySnapshot: [Float] { amplitudeHistory }

    private func configureAudioSession() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(
            .playAndRecord,
            mode: .default,
            options: [.defaultToSpeaker, .allowBluetooth]
        )
        try session.setActive(true, options: [])
    }

    private func deactivateSession() {
        try? AVAudioSession.sharedInstance().setActive(false)
    }

    private func resolveSegmentURL(isFirstSegment: Bool) -> URL {
        let ext = fileExtension()
        // First segment honours the host-provided `outputURL`. Subsequent
        // segments live next to it with a `_segN` suffix so the host's
        // resolver can still target a specific folder.
        if isFirstSegment, let url = outputURL {
            return url
        }
        if let base = outputURL {
            let baseDir = base.deletingLastPathComponent()
            let stem = base.deletingPathExtension().lastPathComponent
            let segIdx = segments.count + 1
            return baseDir.appendingPathComponent("\(stem)_seg\(segIdx).\(ext)")
        }
        let dir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first
            ?? URL(fileURLWithPath: NSTemporaryDirectory())
        let name = "wfr_\(Int(Date().timeIntervalSince1970 * 1000))_seg\(segments.count + 1).\(ext)"
        return dir.appendingPathComponent(name)
    }

    /// File extension for the configured output format.
    private func fileExtension() -> String {
        switch outputFormat.lowercased() {
        case "wav": return "wav"
        case "opus": return "caf" // AVAudioRecorder writes Opus inside a .caf container.
        case "aac": return "m4a"  // AAC is always wrapped in an MPEG-4 container.
        default: return "m4a"
        }
    }

    /// Mime type for the configured output format.
    private func mimeType() -> String {
        switch outputFormat.lowercased() {
        case "wav": return "audio/wav"
        case "opus": return "audio/opus"
        case "aac": return "audio/aac"
        default: return "audio/mp4"
        }
    }

    /// `AVAudioRecorder` settings dict matching the configured format.
    private func recorderSettings() -> [String: Any] {
        let chs = max(1, min(2, channels))
        switch outputFormat.lowercased() {
        case "wav":
            return [
                AVFormatIDKey: Int(kAudioFormatLinearPCM),
                AVSampleRateKey: sampleRate,
                AVNumberOfChannelsKey: chs,
                AVLinearPCMBitDepthKey: 16,
                AVLinearPCMIsBigEndianKey: false,
                AVLinearPCMIsFloatKey: false,
            ]
        case "opus":
            if #available(iOS 11.0, *) {
                return [
                    AVFormatIDKey: Int(kAudioFormatOpus),
                    AVSampleRateKey: sampleRate,
                    AVNumberOfChannelsKey: chs,
                    AVEncoderAudioQualityKey: quality.rawValue,
                    AVEncoderBitRateKey: bitrate,
                ]
            }
            // Fallback to AAC on older OSes.
            return defaultAACSettings(channels: chs)
        case "aac":
            return defaultAACSettings(channels: chs)
        default:
            return defaultAACSettings(channels: chs)
        }
    }

    private func defaultAACSettings(channels chs: Int) -> [String: Any] {
        return [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: sampleRate,
            AVNumberOfChannelsKey: chs,
            AVEncoderAudioQualityKey: quality.rawValue,
            AVEncoderBitRateKey: bitrate,
        ]
    }

    private func segmentDurationMs() -> Int {
        if state == .recording {
            let segment = (CACurrentMediaTime() - segmentStartTime) * 1000
            return inProgressSegmentMs + Int(segment.rounded())
        }
        return inProgressSegmentMs
    }

    private func transition(to newState: State) {
        guard state != newState else { return }
        state = newState
        onStateChange?()
    }

    // MARK: - Metering display link

    private func startMeterDisplayLink() {
        if meterDisplayLink != nil { return }
        let link = CADisplayLink(target: self, selector: #selector(handleMeterTick))
        let target = max(1, min(120, meterUpdatesPerSecond))
        if #available(iOS 15.0, *) {
            link.preferredFrameRateRange = CAFrameRateRange(
                minimum: Float(max(8, target / 2)),
                maximum: Float(target),
                preferred: Float(target)
            )
        } else {
            link.preferredFramesPerSecond = target
        }
        link.add(to: .main, forMode: .common)
        meterDisplayLink = link
        lastMeterTick = 0
    }

    private func stopMeterDisplayLink() {
        meterDisplayLink?.invalidate()
        meterDisplayLink = nil
    }

    // MARK: - Raw-PCM streaming (opt-in; WAV-only)

    /// Spin up a background dispatch timer that tails the active segment
    /// file and emits base64-encoded PCM chunks at `pcmChunkMs` cadence.
    /// No-op on non-WAV outputs (we don't have access to pre-encoded
    /// samples there).
    private func startPcmStreamTimerIfNeeded() {
        guard enablePcmStream, outputFormat == "wav", let url = currentSegmentURL else {
            return
        }
        stopPcmStreamTimer()
        do {
            pcmStreamHandle = try FileHandle(forReadingFrom: url)
        } catch {
            // Surface the error but keep recording — host can recover by
            // toggling `enablePcmStream` off and on.
            onError?(
                "Failed to open WAV file for PCM streaming: \(error.localizedDescription)",
                "pcm-stream"
            )
            return
        }
        // Skip the WAV header so the first chunk is real audio.
        pcmStreamOffset = 44
        let interval = DispatchTimeInterval.milliseconds(max(20, pcmChunkMs))
        let timer = DispatchSource.makeTimerSource(
            queue: DispatchQueue.global(qos: .userInitiated)
        )
        timer.schedule(deadline: .now() + interval, repeating: interval)
        timer.setEventHandler { [weak self] in
            self?.flushPcmStreamChunk()
        }
        timer.resume()
        pcmStreamTimer = timer
    }

    private func stopPcmStreamTimer() {
        pcmStreamTimer?.cancel()
        pcmStreamTimer = nil
        try? pcmStreamHandle?.close()
        pcmStreamHandle = nil
        pcmStreamOffset = 44
    }

    private func flushPcmStreamChunk() {
        guard let handle = pcmStreamHandle else { return }
        do {
            try handle.seek(toOffset: pcmStreamOffset)
            // Cap each chunk at ~256KB so we never blow up the bridge
            // even if the host pegs `pcmChunkMs` very high.
            let bytes = try handle.read(upToCount: 256 * 1024) ?? Data()
            if bytes.isEmpty { return }
            pcmStreamOffset += UInt64(bytes.count)
            let base64 = bytes.base64EncodedString()
            let sr = Int(sampleRate)
            let ch = Int(channels)
            let bps = 2 // We always record 16-bit PCM on the WAV path.
            let ts = completedSegmentsDurationMs + segmentDurationMs()
            DispatchQueue.main.async { [weak self] in
                self?.onPcmChunk?(base64, sr, ch, bps, ts)
            }
        } catch {
            // Transient read failures are non-fatal — skip this tick.
        }
    }

    @objc private func handleMeterTick() {
        guard let rec = recorder, state == .recording else { return }
        let now = CACurrentMediaTime()
        let minInterval = 1.0 / Double(max(1, meterUpdatesPerSecond))
        if lastMeterTick > 0, (now - lastMeterTick) < minInterval - 0.001 {
            return
        }
        lastMeterTick = now

        rec.updateMeters()
        let db = rec.averagePower(forChannel: 0)
        let amp = Self.dbToAmplitude(db)
        if amp > peakAmplitude { peakAmplitude = amp }
        appendAmplitudeBounded(amp)
        durationMs = completedSegmentsDurationMs + segmentDurationMs()
        onMeter?(amp, peakAmplitude, db)

        observeSilence(db: db)

        if maxDurationMs > 0, durationMs >= maxDurationMs {
            onMaxDurationReached?()
            stopFinalize()
        }
    }

    /// Rolling silence-detection logic. Tracks the timestamp of the last
    /// "loud" sample (db >= silenceThresholdDb) and fires `onSilenceDetected`
    /// when the gap exceeds `silenceTimeoutMs`. Only fires once per silence
    /// window — needs a loud sample in between to re-arm.
    private func observeSilence(db: Float) {
        guard silenceTimeoutMs > 0 else {
            lastLoudTime = 0
            silenceFiredForThisWindow = false
            return
        }
        let now = CACurrentMediaTime()
        if db >= silenceThresholdDb {
            lastLoudTime = now
            silenceFiredForThisWindow = false
            return
        }
        // First silent sample — anchor the window so the elapsed math has a
        // baseline.
        if lastLoudTime == 0 {
            lastLoudTime = now
            return
        }
        let elapsedMs = Int((now - lastLoudTime) * 1000)
        if elapsedMs >= silenceTimeoutMs && !silenceFiredForThisWindow {
            silenceFiredForThisWindow = true
            onSilenceDetected?(elapsedMs)
            if autoStopOnSilence {
                stopFinalize()
            }
        }
    }

    /// Hard cap on `amplitudeHistory`. Once we hit this we stride-merge
     /// pairs of samples in place (geometric-mean each pair) so the array
     /// stays bounded over multi-hour sessions but keeps the time-domain
     /// proportions the 64-bucket downsampler relies on.
    private static let maxAmplitudeHistory: Int = 16384

    private func appendAmplitudeBounded(_ value: Float) {
        amplitudeHistory.append(value)
        if amplitudeHistory.count <= Self.maxAmplitudeHistory { return }
        // Compact in-place: each output sample becomes the max of two
        // input samples. Max (vs mean) preserves the visual peaks the
        // downsampler then re-bucketises.
        var compacted: [Float] = []
        compacted.reserveCapacity(Self.maxAmplitudeHistory)
        var i = 0
        while i + 1 < amplitudeHistory.count {
            compacted.append(max(amplitudeHistory[i], amplitudeHistory[i + 1]))
            i += 2
        }
        if i < amplitudeHistory.count {
            compacted.append(amplitudeHistory[i])
        }
        amplitudeHistory = compacted
    }

    static func dbToAmplitude(_ db: Float) -> Float {
        if db <= -60 { return 0 }
        if db >= 0 { return 1 }
        let linear = powf(10, db / 20)
        return max(0, min(1, linear))
    }

    // MARK: - Concatenation + final emission

    private enum ConcatError: LocalizedError {
        case noTracks
        case exportFailed(String)
        var errorDescription: String? {
            switch self {
            case .noTracks: return "Concat: no audio tracks in any segment"
            case .exportFailed(let m): return "Concat: \(m)"
            }
        }
    }

    private func finalizeAndEmit() {
        if segments.count == 1, let url = segments.first {
            emitComplete(url: url, peak: peakAmplitude, history: amplitudeHistory)
            transition(to: .stopped)
            return
        }
        concatenateSegments(segments) { [weak self] result in
            guard let self = self else { return }
            switch result {
            case .success(let url):
                self.emitComplete(url: url, peak: self.peakAmplitude, history: self.amplitudeHistory)
            case .failure(let err):
                self.onError?(err.localizedDescription, "concat")
                if let first = self.segments.first {
                    // Fall back to emitting the first segment so the user
                    // doesn't lose all their audio if concat blew up.
                    self.emitComplete(url: first, peak: self.peakAmplitude, history: self.amplitudeHistory)
                }
            }
            self.transition(to: .stopped)
        }
    }

    private func emitComplete(url: URL, peak: Float, history: [Float]) {
        let size = (try? FileManager.default.attributesOfItem(atPath: url.path)[.size] as? Int) ?? 0
        onComplete?(url.absoluteString, durationMs, size, mimeType(), peak, history)
    }

    /// Concatenate `urls` into a single audio file. WAV segments take a fast
    /// path (raw PCM concat + WAV-header rewrite); m4a/aac/opus segments go
    /// through `AVMutableComposition` + `AVAssetExportSession`. Async —
    /// completion fires on main.
    private func concatenateSegments(
        _ urls: [URL],
        completion: @escaping (Result<URL, Error>) -> Void
    ) {
        if outputFormat.lowercased() == "wav" {
            DispatchQueue.global(qos: .userInitiated).async {
                do {
                    let url = try self.concatenateWavSegments(urls)
                    DispatchQueue.main.async { completion(.success(url)) }
                } catch {
                    DispatchQueue.main.async {
                        completion(.failure(
                            ConcatError.exportFailed(error.localizedDescription)
                        ))
                    }
                }
            }
            return
        }
        DispatchQueue.global(qos: .userInitiated).async {
            let composition = AVMutableComposition()
            guard let track = composition.addMutableTrack(
                withMediaType: .audio,
                preferredTrackID: kCMPersistentTrackID_Invalid
            ) else {
                DispatchQueue.main.async {
                    completion(.failure(ConcatError.noTracks))
                }
                return
            }
            var cursor = CMTime.zero
            for url in urls {
                let asset = AVURLAsset(url: url)
                guard let assetTrack = asset.tracks(withMediaType: .audio).first else {
                    continue
                }
                let range = CMTimeRange(start: .zero, duration: asset.duration)
                do {
                    try track.insertTimeRange(range, of: assetTrack, at: cursor)
                    cursor = CMTimeAdd(cursor, asset.duration)
                } catch {
                    DispatchQueue.main.async {
                        completion(.failure(ConcatError.exportFailed(error.localizedDescription)))
                    }
                    return
                }
            }

            let outDir = self.urlsCachesDirectory()
            let ext = self.fileExtension()
            let outURL = outDir.appendingPathComponent("wfr_concat_\(Int(Date().timeIntervalSince1970 * 1000)).\(ext)")
            try? FileManager.default.removeItem(at: outURL)

            let preset = self.outputFormat.lowercased() == "opus"
                ? AVAssetExportPresetPassthrough
                : AVAssetExportPresetAppleM4A
            guard let exporter = AVAssetExportSession(
                asset: composition,
                presetName: preset
            ) else {
                DispatchQueue.main.async {
                    completion(.failure(ConcatError.exportFailed("AVAssetExportSession unavailable")))
                }
                return
            }
            exporter.outputURL = outURL
            exporter.outputFileType = self.outputFormat.lowercased() == "opus" ? .caf : .m4a
            exporter.exportAsynchronously {
                DispatchQueue.main.async {
                    switch exporter.status {
                    case .completed:
                        completion(.success(outURL))
                    case .failed, .cancelled:
                        completion(.failure(
                            ConcatError.exportFailed(
                                exporter.error?.localizedDescription ?? "export failed"
                            )
                        ))
                    default:
                        break
                    }
                }
            }
        }
    }

    /// Concatenate a list of WAV files into a single WAV. Reads each file's
    /// RIFF header, validates the format, appends the PCM data, and writes a
    /// fresh 44-byte header at the front. Throws on header parse failures.
    private func concatenateWavSegments(_ urls: [URL]) throws -> URL {
        var pcmChunks: [Data] = []
        var headerSampleRate: UInt32 = 0
        var headerChannels: UInt16 = 0
        var headerBitsPerSample: UInt16 = 0
        for url in urls {
            let data = try Data(contentsOf: url)
            guard data.count >= 44 else {
                throw NSError(
                    domain: "WaveformRecorder",
                    code: -1,
                    userInfo: [NSLocalizedDescriptionKey: "WAV \(url.lastPathComponent) is shorter than 44 bytes"]
                )
            }
            // Pull format params off the first segment; assume all subsequent
            // segments match (they will — we created them all with the same
            // AVAudioRecorder configuration).
            let sampleRate = data.subdata(in: 24..<28).withUnsafeBytes { $0.load(as: UInt32.self) }
            let channels = data.subdata(in: 22..<24).withUnsafeBytes { $0.load(as: UInt16.self) }
            let bps = data.subdata(in: 34..<36).withUnsafeBytes { $0.load(as: UInt16.self) }
            if headerSampleRate == 0 {
                headerSampleRate = sampleRate
                headerChannels = channels
                headerBitsPerSample = bps
            }
            // Skip the 44-byte header — append raw PCM only. For
            // non-canonical WAVs with extra chunks AVAudioRecorder doesn't
            // produce them in practice, so the 44-byte assumption holds.
            pcmChunks.append(data.subdata(in: 44..<data.count))
        }
        let pcmData = pcmChunks.reduce(Data()) { $0 + $1 }
        let header = writeWavHeader(
            pcmDataLength: pcmData.count,
            sampleRate: headerSampleRate,
            channels: headerChannels,
            bitsPerSample: headerBitsPerSample
        )
        let outURL = urlsCachesDirectory()
            .appendingPathComponent("wfr_concat_\(Int(Date().timeIntervalSince1970 * 1000)).wav")
        try? FileManager.default.removeItem(at: outURL)
        try (header + pcmData).write(to: outURL)
        return outURL
    }

    /// Build a 44-byte canonical RIFF/WAVE header for PCM data.
    private func writeWavHeader(
        pcmDataLength: Int,
        sampleRate: UInt32,
        channels: UInt16,
        bitsPerSample: UInt16
    ) -> Data {
        var header = Data()
        let byteRate = sampleRate * UInt32(channels) * UInt32(bitsPerSample / 8)
        let blockAlign = channels * (bitsPerSample / 8)
        let totalSize = UInt32(36 + pcmDataLength)
        let dataSize = UInt32(pcmDataLength)

        func append<T>(_ v: T) {
            var value = v
            header.append(Data(bytes: &value, count: MemoryLayout<T>.size))
        }

        header.append("RIFF".data(using: .ascii)!)
        append(totalSize)
        header.append("WAVE".data(using: .ascii)!)
        header.append("fmt ".data(using: .ascii)!)
        append(UInt32(16))                 // fmt chunk size
        append(UInt16(1))                  // PCM format
        append(channels)
        append(sampleRate)
        append(byteRate)
        append(blockAlign)
        append(bitsPerSample)
        header.append("data".data(using: .ascii)!)
        append(dataSize)
        return header
    }

    private func urlsCachesDirectory() -> URL {
        return FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first
            ?? URL(fileURLWithPath: NSTemporaryDirectory())
    }
}
