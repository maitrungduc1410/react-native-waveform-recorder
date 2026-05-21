import AVFoundation
import Foundation
import QuartzCore
import UIKit

/// Native composite UIView wrapped by the Fabric `RCTViewComponentView` shim
/// (`WaveformRecorderView.mm`).
///
/// Layout (left -> right):
///   [ rounded background | (play button, preview state) | bars view | time label ]
///
/// Owns:
///   * `AudioRecorderEngine`  — recorder + segments + (de)concatenation
///   * `AudioPlayerEngine`    — preview-state playback (v0.2)
///   * `WaveformBarsView`     — render
///   * `PlayPauseButton`      — preview-state play/pause overlay
///   * `UILabel`              — timer
///
/// State machine (mirrors the public state):
///
///   idle ⇄ recording ⇄ paused ⇄ preview
///        \                ↓        ↓
///         stopped ─── stop() ──────┘
///
/// Concatenation + multi-segment continue-recording is owned by the engine;
/// this view only orchestrates which engine (recorder / player) is active
/// and what the bars view should be rendering.
@objcMembers
public final class WaveformRecorderViewImpl: UIView {

    // MARK: - Subviews

    private let backgroundView = UIView()
    private let barsView = WaveformBarsView()
    private let timeLabel = UILabel()
    private let playButton = PlayPauseButton()

    // MARK: - Engines

    private let recorderEngine = AudioRecorderEngine()
    private let playerEngine = AudioPlayerEngine()

    // MARK: - Composite state

    /// Single source of truth for the public state machine. This is what the
    /// `onStateChange` event reports.
    enum CompositeState: String {
        case idle, recording, paused, preview, stopped, error
    }
    private var compositeState: CompositeState = .idle {
        didSet { emitStateChange() }
    }

    private var visualAmpsCount: Int = 0
    private var lastVisualSampleTime: CFTimeInterval = 0
    private var lastEmittedState: String = ""
    private var previewDisplayLink: CADisplayLink?
    private var isScrubbing: Bool = false
    private var resumeAfterScrub: Bool = false
    private var previewURL: URL?
    /// Bumped whenever the host issues a command that supersedes an
    /// in-flight `enterPreview()` snapshot (cancel / exit / stop / resume /
    /// teardown / a follow-up enterPreview). The snapshot completion
    /// closure captures the value-at-entry and bails if the counter has
    /// advanced — without this, a multi-segment concat that finishes after
    /// the user has moved on would smuggle the view back into `.preview`
    /// and leak a temp concat file in caches.
    private var previewToken: Int = 0

    // MARK: - Reactive props (set by the .mm Fabric shim)

    public var outputUri: NSString = "" {
        didSet {
            let s = outputUri as String
            recorderEngine.outputURL = s.isEmpty ? nil : URL(string: s)
        }
    }
    public var outputFormat: NSString = "m4a" {
        didSet {
            recorderEngine.outputFormat = outputFormat as String
        }
    }
    public var outputSampleRate: Int = 44100 {
        didSet { recorderEngine.sampleRate = Double(outputSampleRate) }
    }
    public var outputChannels: Int = 1 {
        didSet { recorderEngine.channels = outputChannels }
    }
    public var outputBitrate: Int = 128000 {
        didSet { recorderEngine.bitrate = outputBitrate }
    }
    public var outputQuality: NSString = "high" {
        didSet {
            switch (outputQuality as String).lowercased() {
            case "low": recorderEngine.quality = .low
            case "medium": recorderEngine.quality = .medium
            default: recorderEngine.quality = .high
            }
        }
    }
    public var maxDurationMs: Int = 0 {
        didSet { recorderEngine.maxDurationMs = max(0, maxDurationMs) }
    }
    public var minDurationMs: Int = 0

    public var playedBarColor: UIColor = .white {
        didSet { barsView.playedBarColor = playedBarColor }
    }
    public var unplayedBarColor: UIColor = UIColor.white.withAlphaComponent(0.5) {
        didSet { barsView.unplayedBarColor = unplayedBarColor }
    }
    public var futureBarColor: UIColor? {
        didSet { barsView.futureBarColor = futureBarColor }
    }

    public var barWidth: CGFloat = 3 {
        didSet { barsView.barWidth = barWidth }
    }
    public var barGap: CGFloat = 2 {
        didSet { barsView.barGap = barGap }
    }
    public var barRadius: CGFloat = -1 {
        didSet { barsView.barRadius = barRadius }
    }

    public var containerBackgroundColor: UIColor = UIColor(red: 0.204, green: 0.471, blue: 0.965, alpha: 1) {
        didSet { applyBackground() }
    }
    public var containerBorderRadius: CGFloat = 16 {
        didSet { applyBackground() }
    }
    public var showBackground: Bool = true {
        didSet { applyBackground() }
    }

    public var showTime: Bool = true {
        didSet {
            timeLabel.isHidden = !showTime
            setNeedsLayout()
        }
    }
    public var timeColor: UIColor = .white {
        didSet { timeLabel.textColor = timeColor }
    }
    public var timeMode: NSString = "count-up" {
        didSet { updateTimeLabel() }
    }

    public var recordingMode: NSString = "scroll" {
        didSet {
            barsView.recordingMode = WaveformBarsView.RecordingMode(
                rawValue: (recordingMode as String).lowercased()
            ) ?? .scroll
        }
    }
    public var futureBarStyle: NSString = "hidden" {
        didSet {
            barsView.futureBarStyle = WaveformBarsView.FutureBarStyle(
                rawValue: (futureBarStyle as String).lowercased()
            ) ?? .hidden
        }
    }
    public var newSampleEntry: NSString = "grow" {
        didSet {
            barsView.newSampleEntry = WaveformBarsView.NewSampleEntry(
                rawValue: (newSampleEntry as String).lowercased()
            ) ?? .grow
        }
    }

    public var meterUpdatesPerSecond: Int = 30 {
        didSet { recorderEngine.meterUpdatesPerSecond = max(1, min(120, meterUpdatesPerSecond)) }
    }
    public var samplesPerSecond: Int = 12 {
        didSet { barsView.samplesPerSecond = max(1, min(120, samplesPerSecond)) }
    }

    public var enablePreview: Bool = true
    public var enableContinueRecording: Bool = true
    public var showPlayButton: Bool = true {
        didSet {
            updatePlayButtonVisibility()
            setNeedsLayout()
        }
    }
    public var playButtonColor: UIColor = .white {
        didSet { playButton.iconColor = playButtonColor }
    }

    /// v0.3 — slide-to-cancel gesture configuration. Reattaches the pan
    /// recognizer when toggled so the gesture stays in sync with the host's
    /// declared intent.
    public var enableSlideToCancel: Bool = false {
        didSet { updateGestureRecognizers() }
    }
    public var slideToCancelThresholdDp: CGFloat = 80
    public var enableSlideToLock: Bool = false {
        didSet { updateGestureRecognizers() }
    }
    public var slideToLockThresholdDp: CGFloat = 80

    /// v1.0 — when true, the recorder keeps running while the app is
    /// backgrounded. iOS requires the host app to add `audio` to
    /// `UIBackgroundModes` in `Info.plist`; we log a diagnostic on the
    /// first `start()` call if that key is missing.
    public var backgroundRecording: Bool = false
    public var backgroundNotificationTitle: NSString = "Recording"
    public var backgroundNotificationBody: NSString = "Microphone recording in progress."

    /// v1.0 — opt-in raw PCM streaming (WAV output only).
    public var enablePcmStream: Bool = false {
        didSet { recorderEngine.enablePcmStream = enablePcmStream }
    }
    public var pcmChunkMs: Int = 200 {
        didSet { recorderEngine.pcmChunkMs = pcmChunkMs }
    }

    /// v0.3 — silence detection configuration. Forwarded to the engine on
    /// every assignment so live edits work without restarting recording.
    public var silenceThresholdDb: Float = -160 {
        didSet { recorderEngine.silenceThresholdDb = silenceThresholdDb }
    }
    public var silenceTimeoutMs: Int = 0 {
        didSet { recorderEngine.silenceTimeoutMs = silenceTimeoutMs }
    }
    public var autoStopOnSilence: Bool = false {
        didSet { recorderEngine.autoStopOnSilence = autoStopOnSilence }
    }

    public var controlledState: NSString = "auto" {
        didSet { applyControlledState() }
    }

    // MARK: - Event callbacks (set by .mm)

    public var onStateChange: ((NSString, Int) -> Void)?
    public var onMeter: ((Float, Float, Float) -> Void)?
    public var onComplete: ((NSString, Int, NSString, NSString, Int, Int, Int, NSString, Float) -> Void)?
    public var onMaxDurationReached: (() -> Void)?
    public var onPermissionDenied: (() -> Void)?
    public var onError: ((NSString, NSString) -> Void)?
    public var onSeek: ((Int) -> Void)?
    public var onPlaybackTimeUpdate: ((Int, Int) -> Void)?
    /// (cancelProgress 0..1, lockProgress 0..1)
    public var onSlideProgress: ((Float, Float) -> Void)?
    public var onSlideCancel: (() -> Void)?
    public var onSlideLock: (() -> Void)?
    public var onSilenceDetected: ((Int) -> Void)?
    /// (base64Chunk, sampleRate, channels, bytesPerSample, timestampMs)
    public var onPcmChunk: ((String, Int, Int, Int, Int) -> Void)?

    // MARK: - Gesture state

    private var slidePanRecognizer: UIPanGestureRecognizer?
    private var slideStartPoint: CGPoint = .zero
    private var slideHasFiredCancel: Bool = false
    private var slideHasFiredLock: Bool = false

    // MARK: - Init

    public override init(frame: CGRect) {
        super.init(frame: frame)
        commonInit()
    }
    public required init?(coder: NSCoder) {
        super.init(coder: coder)
        commonInit()
    }
    deinit {
        stopPreviewDisplayLink()
        recorderEngine.reset()
        playerEngine.reset()
        // Best-effort: drop the concat temp file we owned. Single-segment
        // previewURLs alias a segment file the engine just deleted via
        // its own cancel() path, so deleteIfTempConcat correctly skips
        // those.
        if let url = previewURL {
            Self.deleteIfTempConcat(url)
        }
    }

    private func commonInit() {
        backgroundColor = .clear
        clipsToBounds = false

        backgroundView.layer.cornerRadius = containerBorderRadius
        backgroundView.backgroundColor = containerBackgroundColor
        addSubview(backgroundView)

        playButton.iconColor = playButtonColor
        playButton.isHidden = true
        playButton.addTarget(self, action: #selector(handlePlayButtonTap), for: .touchUpInside)
        addSubview(playButton)

        barsView.playedBarColor = playedBarColor
        barsView.unplayedBarColor = unplayedBarColor
        barsView.barWidth = barWidth
        barsView.barGap = barGap
        barsView.barRadius = barRadius
        barsView.onScrubBegan = { [weak self] f in self?.handleScrubBegan(fraction: f) }
        barsView.onScrubMoved = { [weak self] f in self?.handleScrubMoved(fraction: f) }
        barsView.onScrubEnded = { [weak self] f, c in self?.handleScrubEnded(fraction: f, cancelled: c) }
        addSubview(barsView)

        timeLabel.text = "0:00"
        timeLabel.textColor = timeColor
        timeLabel.font = UIFont.systemFont(ofSize: 13, weight: .semibold)
        timeLabel.textAlignment = .right
        addSubview(timeLabel)

        wireEngineCallbacks()
    }

    // MARK: - Layout

    public override func layoutSubviews() {
        super.layoutSubviews()
        backgroundView.frame = bounds

        let inset: CGFloat = 12
        let height = bounds.height

        var leftEdge: CGFloat = inset
        let buttonVisible = (compositeState == .preview) && showPlayButton
        if buttonVisible {
            let buttonSize = min(height * 0.6, 36)
            playButton.frame = CGRect(
                x: inset,
                y: (height - buttonSize) / 2,
                width: buttonSize,
                height: buttonSize
            )
            leftEdge += buttonSize + 8
        } else {
            playButton.frame = .zero
        }

        let timeWidth: CGFloat = showTime ? 48 : 0

        if showTime {
            timeLabel.frame = CGRect(
                x: bounds.width - inset - timeWidth,
                y: 0,
                width: timeWidth,
                height: height
            )
            timeLabel.textAlignment = .right
        } else {
            timeLabel.frame = .zero
        }

        let barsX = leftEdge
        let barsRight = bounds.width - inset - (timeWidth > 0 ? timeWidth + 8 : 0)
        barsView.frame = CGRect(
            x: barsX,
            y: 0,
            width: max(0, barsRight - barsX),
            height: height
        )
    }

    // MARK: - Background

    private func applyBackground() {
        if showBackground {
            backgroundView.isHidden = false
            backgroundView.backgroundColor = containerBackgroundColor
            backgroundView.layer.cornerRadius = containerBorderRadius
            backgroundView.layer.masksToBounds = true
        } else {
            backgroundView.isHidden = true
        }
    }

    // MARK: - Engine plumbing

    private func wireEngineCallbacks() {
        recorderEngine.onStateChange = { [weak self] in
            self?.handleRecorderStateChange()
        }
        recorderEngine.onMeter = { [weak self] amplitude, peak, db in
            guard let self = self else { return }
            self.onMeter?(amplitude, peak, db)
            let now = CACurrentMediaTime()
            let minInterval = 1.0 / Double(max(1, self.samplesPerSecond))
            if self.lastVisualSampleTime == 0 || (now - self.lastVisualSampleTime) >= minInterval - 0.001 {
                self.lastVisualSampleTime = now
                self.barsView.append(amplitude: CGFloat(amplitude))
                self.visualAmpsCount += 1
            }
            self.updateTimeLabel()
        }
        recorderEngine.onMaxDurationReached = { [weak self] in
            self?.onMaxDurationReached?()
        }
        recorderEngine.onSilenceDetected = { [weak self] elapsedMs in
            self?.onSilenceDetected?(elapsedMs)
        }
        recorderEngine.onPcmChunk = { [weak self] chunk, sr, ch, bps, ts in
            self?.onPcmChunk?(chunk, sr, ch, bps, ts)
        }
        recorderEngine.onPermissionDenied = { [weak self] in
            self?.onPermissionDenied?()
        }
        recorderEngine.onError = { [weak self] msg, code in
            self?.onError?(msg as NSString, (code ?? "") as NSString)
        }
        recorderEngine.onComplete = { [weak self] uri, durationMs, sizeBytes, mimeType, peak, history in
            guard let self = self else { return }
            let samples = Self.downsampleTo64(history)
            let csv = samples.map { String(format: "%.4f", $0) }.joined(separator: ",")
            self.onComplete?(
                uri as NSString,
                durationMs,
                ((self.outputFormat as String).isEmpty ? "m4a" : self.outputFormat),
                mimeType as NSString,
                sizeBytes,
                Int(self.recorderEngine.sampleRate),
                self.recorderEngine.channels,
                csv as NSString,
                peak
            )
            // Reset visual + composite state once the file is on disk.
            self.cleanupAfterStop()
        }

        playerEngine.onLoad = { [weak self] _ in
            // No-op for the public API — duration is already exposed via
            // onStateChange.durationMs. We use this internally only to
            // start the display link.
            self?.startPreviewDisplayLink()
        }
        playerEngine.onLoadError = { [weak self] msg in
            self?.onError?(msg as NSString, "preview-load")
        }
        playerEngine.onStateChange = { [weak self] in
            guard let self = self else { return }
            self.playButton.isPlaying = self.playerEngine.isPlaying
            if !self.playerEngine.isPlaying {
                self.stopPreviewDisplayLink()
            }
        }
        playerEngine.onTimeUpdate = { [weak self] currentMs, durationMs in
            guard let self = self else { return }
            if self.isScrubbing { return }
            self.barsView.progressFraction = durationMs > 0
                ? CGFloat(currentMs) / CGFloat(durationMs)
                : 0
            self.updateTimeLabel(currentMs: currentMs, durationMs: durationMs)
            self.onPlaybackTimeUpdate?(currentMs, durationMs)
        }
        playerEngine.onEnded = { [weak self] in
            self?.stopPreviewDisplayLink()
            self?.playButton.isPlaying = false
        }
    }

    private func handleRecorderStateChange() {
        defer { updateGestureRecognizers() }
        switch recorderEngine.state {
        case .recording:
            barsView.isRecording = true
            transitionComposite(.recording)
        case .paused:
            barsView.isRecording = true  // keep showing the recorded so-far bars
            transitionComposite(.paused)
        case .betweenSegments:
            // Internal state — surface as `.paused` to the world.
            barsView.isRecording = true
            transitionComposite(.paused)
        case .stopped:
            // `onComplete` already cleaned up the bars view; nothing extra here.
            break
        case .idle:
            barsView.isRecording = false
            barsView.clearRecordingAmplitudes()
            // Engine just reset `durationMs` to 0 — refresh the label so the
            // last frozen value from a prior stop doesn't linger after cancel.
            updateTimeLabel()
            transitionComposite(.idle)
        case .error:
            transitionComposite(.error)
        }
    }

    private func transitionComposite(_ target: CompositeState) {
        if compositeState != target {
            compositeState = target
            updatePlayButtonVisibility()
            setNeedsLayout()
        }
    }

    private func cleanupAfterStop() {
        // Flip the bars view out of "live recording" mode so the scroll
        // display link stops spinning. We intentionally do NOT clear the
        // ring buffer — leaving the just-recorded amps in place lets the
        // view stay frozen at "last frame of recording", so the user sees
        // the waveform + duration label until they trigger the next
        // action (start a new recording, enter preview, or cancel).
        barsView.isRecording = false
        // We keep `compositeState = .stopped` so the host can re-enter
        // `start()` for a fresh session.
        compositeState = .stopped
        updatePlayButtonVisibility()
        setNeedsLayout()
    }

    private func emitStateChange() {
        let s = compositeState.rawValue
        guard s != lastEmittedState else { return }
        lastEmittedState = s
        onStateChange?(s as NSString, recorderEngine.durationMs)
    }

    // MARK: - Time label

    private func updateTimeLabel(currentMs: Int? = nil, durationMs: Int? = nil) {
        let dur: Int
        let cur: Int
        if compositeState == .preview {
            cur = currentMs ?? playerEngine.currentMs
            dur = durationMs ?? max(playerEngine.durationMs, recorderEngine.durationMs)
        } else {
            cur = recorderEngine.durationMs
            dur = recorderEngine.maxDurationMs
        }
        let mode = (timeMode as String).lowercased()
        let display: Int
        if mode == "count-down", dur > 0 {
            display = max(0, dur - cur)
        } else {
            display = cur
        }
        let totalSeconds = display / 1000
        let minutes = totalSeconds / 60
        let seconds = totalSeconds % 60
        timeLabel.text = String(format: "%d:%02d", minutes, seconds)
    }

    // MARK: - Play button

    private func updatePlayButtonVisibility() {
        let visible = (compositeState == .preview) && showPlayButton
        playButton.isHidden = !visible
    }

    @objc private func handlePlayButtonTap() {
        guard compositeState == .preview else { return }
        playerEngine.toggle()
    }

    // MARK: - Scrub (preview only)

    private func handleScrubBegan(fraction: CGFloat) {
        guard compositeState == .preview else { return }
        isScrubbing = true
        resumeAfterScrub = playerEngine.isPlaying
        if playerEngine.isPlaying { playerEngine.pause() }
        let pos = positionFromFraction(fraction)
        playerEngine.seek(toMs: pos)
        // Drive `progressFraction` directly during the scrub — the
        // `playerEngine.onTimeUpdate` callback (which normally moves it)
        // bails on `isScrubbing`, and AVPlayer's `seek` is async so the
        // next time-observer tick can lag a frame or two behind the
        // finger. Updating here keeps the played/unplayed split glued to
        // the touch point.
        barsView.progressFraction = fraction
        updateTimeLabel(currentMs: pos, durationMs: playerEngine.durationMs)
    }
    private func handleScrubMoved(fraction: CGFloat) {
        guard compositeState == .preview else { return }
        let pos = positionFromFraction(fraction)
        playerEngine.seek(toMs: pos)
        barsView.progressFraction = fraction
        updateTimeLabel(currentMs: pos, durationMs: playerEngine.durationMs)
    }
    private func handleScrubEnded(fraction: CGFloat, cancelled: Bool) {
        guard compositeState == .preview else { return }
        isScrubbing = false
        let pos = positionFromFraction(fraction)
        playerEngine.seek(toMs: pos)
        barsView.progressFraction = fraction
        updateTimeLabel(currentMs: pos, durationMs: playerEngine.durationMs)
        onSeek?(pos)
        if !cancelled, resumeAfterScrub {
            playerEngine.play()
        }
    }
    private func positionFromFraction(_ fraction: CGFloat) -> Int {
        let dur = playerEngine.durationMs
        guard dur > 0 else { return 0 }
        let clamped = max(0, min(1, fraction))
        return Int(clamped * CGFloat(dur))
    }

    // MARK: - Controlled-state handling

    private func applyControlledState() {
        let desired = (controlledState as String).lowercased()
        guard desired != "auto", !desired.isEmpty else { return }
        switch desired {
        case "recording":
            if compositeState == .paused {
                resumeCommand()
            } else if compositeState == .idle || compositeState == .stopped {
                startCommand()
            } else if compositeState == .preview {
                resumeCommand()
            }
        case "paused":
            if compositeState == .recording {
                pauseCommand()
            }
        case "preview":
            if compositeState == .paused || compositeState == .recording {
                enterPreviewCommand()
            }
        case "stopped":
            if compositeState == .recording || compositeState == .paused || compositeState == .preview {
                stopCommand()
            }
        case "idle":
            if compositeState != .idle {
                cancelCommand()
            }
        default:
            break
        }
    }

    // MARK: - Imperative commands (called from .mm)

    public func startCommand() {
        if isControlled() {
            onStateChange?("recording" as NSString, recorderEngine.durationMs)
            return
        }
        if backgroundRecording {
            checkBackgroundAudioCapability()
        }
        ensurePermissionThen { [weak self] in
            self?.recorderEngine.start()
        }
    }

    /// Emit a one-time diagnostic if the host enabled `backgroundRecording`
    /// but didn't declare the `audio` background mode in `Info.plist`. The
    /// recorder still starts — it just won't survive backgrounding.
    private func checkBackgroundAudioCapability() {
        struct Once { static var didCheck = false }
        if Once.didCheck { return }
        Once.didCheck = true
        let modes = Bundle.main.object(
            forInfoDictionaryKey: "UIBackgroundModes"
        ) as? [String] ?? []
        if !modes.contains("audio") {
            onError?(
                "backgroundRecording=true but `audio` is missing from UIBackgroundModes; recording will pause when the app is backgrounded." as NSString,
                "background-capability"
            )
        }
    }

    public func pauseCommand() {
        if isControlled() {
            onStateChange?("paused" as NSString, recorderEngine.durationMs)
            return
        }
        if compositeState == .recording {
            recorderEngine.pause()
        }
    }

    public func resumeCommand() {
        if isControlled() {
            onStateChange?("recording" as NSString, recorderEngine.durationMs)
            return
        }
        // Supersede any in-flight enterPreview snapshot — the user is
        // explicitly asking to continue recording, not preview.
        previewToken += 1
        if compositeState == .paused {
            recorderEngine.resume()
        } else if compositeState == .preview {
            // WhatsApp continue: tear down the player + start a new segment.
            if !enableContinueRecording {
                onError?(
                    "enableContinueRecording is false; resume() from preview is disabled" as NSString,
                    "continue-disabled" as NSString
                )
                return
            }
            exitPreviewInternal()
            recorderEngine.resume() // from .betweenSegments
        }
    }

    public func stopCommand() {
        if isControlled() {
            onStateChange?("stopped" as NSString, recorderEngine.durationMs)
            return
        }
        // Supersede any in-flight enterPreview snapshot — the user is
        // ending the session, not waiting for a preview to appear.
        previewToken += 1
        if minDurationMs > 0, recorderEngine.durationMs < minDurationMs,
           compositeState == .recording || compositeState == .paused {
            recorderEngine.cancel()
            onError?(
                "Recording cancelled: below minDurationMs (\(recorderEngine.durationMs)/\(minDurationMs)ms)" as NSString,
                "min-duration" as NSString
            )
            return
        }
        if compositeState == .preview {
            stopFromPreview()
            return
        }
        recorderEngine.stopFinalize()
    }

    public func cancelCommand() {
        if isControlled() {
            onStateChange?("idle" as NSString, recorderEngine.durationMs)
            return
        }
        // Supersede any in-flight enterPreview snapshot — the user is
        // discarding the session.
        previewToken += 1
        if compositeState == .preview {
            exitPreviewInternal()
        }
        recorderEngine.cancel()
        compositeState = .idle
        emitStateChange()
    }

    public func enterPreviewCommand() {
        if isControlled() {
            onStateChange?("preview" as NSString, recorderEngine.durationMs)
            return
        }
        if !enablePreview {
            onError?(
                "enablePreview is false; enterPreview() is disabled" as NSString,
                "preview-disabled" as NSString
            )
            return
        }
        // Pause + finalise the in-progress segment so it's playable.
        recorderEngine.pauseAndFinalizeSegment()
        // Generation-counter guard: every enterPreview gets a fresh token,
        // and any intervening cancel / stop / resume / exit / teardown
        // bumps `previewToken` so this closure becomes a no-op when it
        // eventually fires (multi-segment concat can take seconds).
        previewToken += 1
        let token = previewToken
        recorderEngine.snapshotForPreview { [weak self] url, err in
            guard let self = self else { return }
            guard self.previewToken == token else {
                // Host has moved on — drop the concat file the snapshot
                // just produced so it doesn't linger in caches.
                if let url = url {
                    Self.deleteIfTempConcat(url)
                }
                return
            }
            if let err = err {
                self.onError?(err as NSString, "preview-snapshot" as NSString)
                return
            }
            guard let url = url else {
                self.onError?("Preview snapshot returned no URL" as NSString, "preview-snapshot")
                return
            }
            // Drop any prior preview concat before we overwrite the ref —
            // back-to-back re-entries would otherwise accumulate temp
            // files for every multi-segment cycle.
            if let old = self.previewURL {
                Self.deleteIfTempConcat(old)
            }
            self.previewURL = url
            self.barsView.amplitudes = self.recorderEngine.amplitudeHistorySnapshot.map { CGFloat($0) }
            self.barsView.isRecording = false
            self.barsView.progressFraction = 0
            self.playerEngine.setSource(url: url)
            self.transitionComposite(.preview)
        }
    }

    public func exitPreviewCommand() {
        if isControlled() {
            onStateChange?("paused" as NSString, recorderEngine.durationMs)
            return
        }
        // Supersede any in-flight enterPreview snapshot — the user is
        // exiting the preview state entirely.
        previewToken += 1
        exitPreviewInternal()
        // Route through transitionComposite so the play button hides and
        // the layout reflows — a bare `compositeState = .paused` only
        // fires the state event and leaves the preview-state UI on screen.
        transitionComposite(.paused)
    }

    public func togglePreviewPlaybackCommand() {
        guard compositeState == .preview else { return }
        playerEngine.toggle()
    }

    public func seekPreviewCommand(_ positionMs: Int) {
        guard compositeState == .preview else { return }
        playerEngine.seek(toMs: positionMs)
        let dur = playerEngine.durationMs
        let frac = dur > 0 ? CGFloat(positionMs) / CGFloat(dur) : 0
        barsView.progressFraction = frac
        updateTimeLabel(currentMs: positionMs, durationMs: dur)
        onSeek?(positionMs)
    }

    public func tearDown() {
        // Supersede any in-flight enterPreview snapshot before we tear
        // down so the callback doesn't paint UI onto a recycled view.
        previewToken += 1
        stopPreviewDisplayLink()
        recorderEngine.reset()
        playerEngine.reset()
        barsView.clearRecordingAmplitudes()
        barsView.amplitudes = []
        timeLabel.text = "0:00"
        lastEmittedState = ""
        compositeState = .idle
        if let url = previewURL {
            Self.deleteIfTempConcat(url)
        }
        previewURL = nil
    }

    private func exitPreviewInternal() {
        if playerEngine.isPlaying { playerEngine.pause() }
        playerEngine.reset()
        stopPreviewDisplayLink()
        barsView.progressFraction = 0
        // Switch back to "recording-style" rendering so user sees the bars.
        // The isRecording setter wipes the ring buffer on `false -> true`
        // (it assumes a fresh recording session), so re-seed it from the
        // recorder's amplitude history snapshot to preserve the waveform
        // the user just saw in preview.
        let history = recorderEngine.amplitudeHistorySnapshot.map { CGFloat($0) }
        barsView.isRecording = true
        barsView.setRecordingAmplitudes(history)
        // Multi-segment previews materialise a concat file in caches that
        // only this view layer references — drop it now so the next
        // preview cycle gets a fresh one.
        if let url = previewURL {
            Self.deleteIfTempConcat(url)
            previewURL = nil
        }
    }

    private func stopFromPreview() {
        // Player already has the preview URL; the recorder owns the
        // segments. Just trigger the engine's stop path — it will hit
        // `onComplete` with the final (possibly concatenated) URL.
        if playerEngine.isPlaying { playerEngine.pause() }
        playerEngine.reset()
        stopPreviewDisplayLink()
        // The preview's concat (if any) is independent from the file
        // stopFinalize() will produce, so release it here.
        if let url = previewURL {
            Self.deleteIfTempConcat(url)
            previewURL = nil
        }
        // recorder is in `.betweenSegments` — calling stopFinalize() will
        // wrap up emission.
        recorderEngine.stopFinalize()
    }

    /// Best-effort delete for the temp concat file `snapshotForPreview`
    /// produces for multi-segment recordings. Single-segment previewURLs
    /// alias a segment file owned by the recorder engine — those don't
    /// start with `wfr_concat_` and are intentionally skipped here so the
    /// engine's own segment-cleanup path stays the single source of truth.
    private static func deleteIfTempConcat(_ url: URL) {
        let name = url.lastPathComponent
        guard name.hasPrefix("wfr_concat_") else { return }
        try? FileManager.default.removeItem(at: url)
    }

    private func isControlled() -> Bool {
        let v = (controlledState as String).lowercased()
        return !v.isEmpty && v != "auto"
    }

    private func ensurePermissionThen(_ run: @escaping () -> Void) {
        if recorderEngine.hasMicrophonePermission {
            run()
            return
        }
        recorderEngine.requestPermission { [weak self] granted in
            guard let self = self else { return }
            if granted {
                run()
            } else {
                self.onPermissionDenied?()
            }
        }
    }

    // MARK: - Preview display link

    private func startPreviewDisplayLink() {
        if previewDisplayLink != nil { return }
        let link = CADisplayLink(target: self, selector: #selector(handlePreviewTick))
        if #available(iOS 15.0, *) {
            link.preferredFrameRateRange = CAFrameRateRange(minimum: 24, maximum: 30, preferred: 30)
        } else {
            link.preferredFramesPerSecond = 30
        }
        link.add(to: .main, forMode: .common)
        previewDisplayLink = link
    }
    private func stopPreviewDisplayLink() {
        previewDisplayLink?.invalidate()
        previewDisplayLink = nil
    }
    @objc private func handlePreviewTick() {
        guard compositeState == .preview else { return }
        let dur = playerEngine.durationMs
        guard dur > 0 else { return }
        let cur = playerEngine.currentMs
        if !isScrubbing {
            barsView.progressFraction = CGFloat(cur) / CGFloat(dur)
        }
        updateTimeLabel(currentMs: cur, durationMs: dur)
    }

    // MARK: - WhatsApp 64-bucket downsampling

    static func downsampleTo64(_ samples: [Float]) -> [Float] {
        let buckets = 64
        guard !samples.isEmpty else { return [Float](repeating: 0, count: buckets) }
        var sumSquares = [Double](repeating: 0, count: buckets)
        var counts = [Int](repeating: 0, count: buckets)
        for (i, s) in samples.enumerated() {
            let bucket = min(buckets - 1, (i * buckets) / samples.count)
            let v = Double(s)
            sumSquares[bucket] += v * v
            counts[bucket] += 1
        }
        var out = [Float](repeating: 0, count: buckets)
        var maxV: Float = 0
        for i in 0..<buckets {
            let n = counts[i]
            if n > 0 {
                let rms = Float(sqrt(sumSquares[i] / Double(n)))
                out[i] = rms
                if rms > maxV { maxV = rms }
            }
        }
        if maxV > 0 {
            for i in 0..<buckets {
                out[i] = max(0, min(1, out[i] / maxV))
            }
        }
        return out
    }

    // MARK: - Slide-to-cancel / slide-to-lock gestures (v0.3)

    /// Attach / detach the pan recognizer based on whether either gesture is
    /// enabled and the composite state is `recording`. Idempotent — safe to
    /// call from prop didSets, recorder state transitions, and lifecycle.
    private func updateGestureRecognizers() {
        let shouldHaveGesture = (enableSlideToCancel || enableSlideToLock) &&
            compositeState == .recording
        if shouldHaveGesture {
            if slidePanRecognizer != nil { return }
            let pan = UIPanGestureRecognizer(
                target: self,
                action: #selector(handleSlidePan(_:))
            )
            // Don't fight the bars view's scrub recognizer in preview state
            // — the scrub recognizer is created on demand inside the bars
            // view and only intercepts touches when isInteractive == true.
            pan.cancelsTouchesInView = false
            pan.delaysTouchesBegan = false
            pan.delaysTouchesEnded = false
            addGestureRecognizer(pan)
            slidePanRecognizer = pan
        } else {
            if let pan = slidePanRecognizer {
                removeGestureRecognizer(pan)
                slidePanRecognizer = nil
            }
            // Make sure stale progress events don't linger after detach.
            if slideHasFiredCancel || slideHasFiredLock {
                slideHasFiredCancel = false
                slideHasFiredLock = false
            }
        }
    }

    @objc private func handleSlidePan(_ pan: UIPanGestureRecognizer) {
        switch pan.state {
        case .began:
            slideStartPoint = pan.location(in: self)
            slideHasFiredCancel = false
            slideHasFiredLock = false
            onSlideProgress?(0, 0)
        case .changed:
            let loc = pan.location(in: self)
            let dx = loc.x - slideStartPoint.x
            let dy = loc.y - slideStartPoint.y
            // Cancel = drag toward the leading edge of the recorder UI
            // (left, negative dx). Lock = drag up.
            let cancelSign: CGFloat = -1
            var cancelProgress: CGFloat = 0
            if enableSlideToCancel && slideToCancelThresholdDp > 0 {
                cancelProgress = max(0, min(1, cancelSign * dx / slideToCancelThresholdDp))
            }
            var lockProgress: CGFloat = 0
            if enableSlideToLock && slideToLockThresholdDp > 0 {
                lockProgress = max(0, min(1, -dy / slideToLockThresholdDp))
            }
            onSlideProgress?(Float(cancelProgress), Float(lockProgress))
            if enableSlideToCancel,
               !slideHasFiredCancel,
               cancelProgress >= 1.0,
               // Cancel wins when horizontal progress runs first
               cancelProgress >= lockProgress {
                slideHasFiredCancel = true
                onSlideCancel?()
                // End the gesture so the user has to lift + re-touch to
                // trigger again — also stops further progress events for
                // this drag.
                pan.isEnabled = false
                pan.isEnabled = true
            } else if enableSlideToLock,
                      !slideHasFiredLock,
                      lockProgress >= 1.0 {
                slideHasFiredLock = true
                onSlideLock?()
                pan.isEnabled = false
                pan.isEnabled = true
            }
        case .ended, .cancelled, .failed:
            if !slideHasFiredCancel && !slideHasFiredLock {
                onSlideProgress?(0, 0)
            }
            slideHasFiredCancel = false
            slideHasFiredLock = false
        default:
            break
        }
    }
}
