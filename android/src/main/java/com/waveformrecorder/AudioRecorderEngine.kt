package com.waveformrecorder

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import android.media.MediaRecorder
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import java.io.File
import java.io.FileOutputStream
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.log10
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

/**
 * Thin wrapper around `android.media.MediaRecorder` with periodic metering
 * polled on a main-thread `Handler`. Exposes the events the rest of the
 * component needs: state lifecycle, periodic amplitude updates, max-duration
 * auto-stop, completion summary, error reporting.
 *
 * v0.2 — Adds a multi-segment recording timeline so the view layer can
 * drop into and out of `preview` without losing audio (WhatsApp / Messenger
 * "continue recording" UX). When the host calls `pauseAndFinalizeSegment()`,
 * the in-progress m4a file is finalised and added to `segments`. Calling
 * `resume()` from `BETWEEN_SEGMENTS` opens a *new* m4a file. `stopFinalize()`
 * concatenates the segment list with `MediaMuxer` + `MediaExtractor` and
 * fires `onComplete` with a single output URL.
 *
 * All callbacks fire on the main thread.
 *
 * v0.1 supports `m4a` only. v0.3 will add a `wav` path via `AudioRecord` +
 * custom WAV header writer, and `opus` via `MediaRecorder.OutputFormat.OGG`
 * on API 29+.
 */
class AudioRecorderEngine(private val context: Context) {

    enum class State {
        IDLE,
        RECORDING,
        PAUSED,
        /** Between segments — recorder torn down, awaiting `resume()` or `stopFinalize()`. */
        BETWEEN_SEGMENTS,
        STOPPED,
        ERROR
    }

    @Volatile var state: State = State.IDLE
        private set

    /** Cumulative recorded duration across all segments (excludes paused/preview time). */
    var durationMs: Int = 0
        private set

    var peakAmplitude: Float = 0f
        private set

    // ---------- Configuration (set before `start()`) ----------

    /** On-disk output. `null` = auto-pick a cache-dir m4a file. */
    var outputFile: File? = null
    var sampleRate: Int = 44100
    var channels: Int = 1
    var bitrate: Int = 128_000

    /** Encoder quality preset. `low` / `medium` / `high`. Maps to encoder params. */
    var quality: String = "high"
    /** 0 = no max. When reached, recorder stops automatically. */
    var maxDurationMs: Int = 0
    /** Hz. Polled via a main-thread handler at this cadence. */
    var meterUpdatesPerSecond: Int = 30
    /**
     * One of `m4a` | `aac` | `wav` | `opus`.
     *
     *   - `m4a` (default) / `aac` → `MediaRecorder` + AAC encoder.
     *   - `wav` → `AudioRecord` + manual 16-bit PCM writer (this class
     *     implements both code paths internally so the view layer doesn't
     *     have to switch engines).
     *   - `opus` → `MediaRecorder` + OGG/OPUS on API 29+; falls back to AAC
     *     on older devices and fires `onError("Opus unsupported", "format-unsupported")`.
     */
    var outputFormat: String = "m4a"

    // ---------- Silence detection (v0.3) ----------

    /** dBFS threshold below which the engine considers the input "silent". */
    var silenceThresholdDb: Float = -160f
    /** Minimum window of sustained silence (ms) before firing the callback. */
    var silenceTimeoutMs: Int = 0
    /** When true, the engine auto-stops once silence is detected. */
    var autoStopOnSilence: Boolean = false

    // ---------- Callbacks ----------

    var onStateChange: (() -> Unit)? = null
    /** (linearAmplitude in [0, 1], peakSoFar in [0, 1], averagePowerDb). */
    var onMeter: ((Float, Float, Float) -> Unit)? = null
    var onMaxDurationReached: (() -> Unit)? = null

    /** v1.0 — raw-PCM streaming (WAV path only). */
    var enablePcmStream: Boolean = false
    var pcmChunkMs: Int = 200
    /** (base64Chunk, sampleRate, channels, bytesPerSample, timestampMs) */
    var onPcmChunk: ((String, Int, Int, Int, Int) -> Unit)? = null
    /** (elapsedSilenceMs). */
    var onSilenceDetected: ((Int) -> Unit)? = null
    var onPermissionDenied: (() -> Unit)? = null
    var onError: ((String, String?) -> Unit)? = null
    var onComplete: (
        (uri: String,
         durationMs: Int,
         sizeBytes: Int,
         mimeType: String,
         peakAmplitude: Float,
         amplitudeHistory: FloatArray) -> Unit
    )? = null

    // ---------- Segments ----------

    /** Completed segment files, in order. Does NOT include the in-progress one. */
    private val segments = ArrayList<File>()
    fun segmentsSnapshot(): List<File> = segments.toList()

    /** File currently being written by the active `MediaRecorder`, or null. */
    private var currentSegmentFile: File? = null

    private var completedSegmentsDurationMs: Int = 0
    private var inProgressSegmentMs: Int = 0

    // ---------- Internal ----------

    private var recorder: MediaRecorder? = null
    private var wavRecord: WavRecording? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private var segmentStartNs: Long = 0
    private val amplitudeHistory = ArrayList<Float>(4096)

    // v0.3 — silence detection state
    private var lastLoudNs: Long = 0L
    private var silenceFiredForThisWindow: Boolean = false

    /** Snapshot of the recorded-so-far amplitudes for the view's preview render. */
    val amplitudeHistorySnapshot: FloatArray
        get() = amplitudeHistory.toFloatArray()

    private val meterRunnable = object : Runnable {
        override fun run() {
            if (state != State.RECORDING) return
            val peak16: Int = if (outputFormat.equals("wav", ignoreCase = true)) {
                // The WAV writer thread computes amplitude directly from PCM
                // samples — pull the latest snapshot from there.
                ((wavRecord?.lastPeakLinear ?: 0f) * 32767f).toInt()
            } else {
                val rec = recorder ?: return
                try { rec.maxAmplitude } catch (_: Exception) { 0 }
            }
            val linear = (peak16.toFloat() / 32767f).coerceIn(0f, 1f)
            val db = if (linear <= 0f) -160f else (20f * log10(linear))
            val visualAmp = sqrt(linear).coerceIn(0f, 1f)
            if (visualAmp > peakAmplitude) peakAmplitude = visualAmp
            appendAmplitudeBounded(visualAmp)
            durationMs = currentDurationMs()
            onMeter?.invoke(visualAmp, peakAmplitude, db)

            observeSilence(db)

            if (maxDurationMs > 0 && durationMs >= maxDurationMs) {
                onMaxDurationReached?.invoke()
                stopFinalize()
                return
            }

            val intervalMs = 1000L / max(1, min(120, meterUpdatesPerSecond))
            mainHandler.postDelayed(this, intervalMs)
        }
    }

    // ---------- Permissions ----------

    val hasMicrophonePermission: Boolean
        get() = context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED

    // ---------- Public API ----------

    /**
     * Begin recording into a fresh segment. From `IDLE` / `STOPPED` / `ERROR`,
     * resets the segment list; from `PAUSED`, delegates to `resume()`; from
     * `BETWEEN_SEGMENTS`, opens a new m4a segment appended at the next
     * `pauseAndFinalizeSegment()` / `stopFinalize()`.
     */
    fun start() {
        if (state == State.RECORDING) return

        if (!hasMicrophonePermission) {
            onPermissionDenied?.invoke()
            return
        }
        if (state == State.PAUSED) {
            resume()
            return
        }

        val isFreshSession = state == State.IDLE ||
            state == State.STOPPED ||
            state == State.ERROR
        if (isFreshSession) {
            segments.clear()
            completedSegmentsDurationMs = 0
            durationMs = 0
            peakAmplitude = 0f
            amplitudeHistory.clear()
        }
        inProgressSegmentMs = 0

        val file = resolveSegmentFile(isFreshSession)
        currentSegmentFile = file

        if (outputFormat.equals("wav", ignoreCase = true)) {
            startWavRecording(file)
            return
        }

        val rec: MediaRecorder = try {
            createMediaRecorder()
        } catch (e: Exception) {
            transition(State.ERROR)
            onError?.invoke("Failed to instantiate MediaRecorder: ${e.message}", "start")
            return
        }

        try {
            rec.setAudioSource(MediaRecorder.AudioSource.MIC)
            applyMediaRecorderFormat(rec)
            rec.setAudioSamplingRate(sampleRate)
            rec.setAudioChannels(channels.coerceIn(1, 2))
            rec.setAudioEncodingBitRate(quantizeBitrate(bitrate, quality))
            // Total-recording cap is enforced by the meter loop across all
            // segments — don't ask MediaRecorder to enforce it per-segment.
            rec.setOutputFile(file.absolutePath)
            rec.setOnErrorListener { _, what, extra ->
                Log.e(TAG, "MediaRecorder.onError what=$what extra=$extra")
                onError?.invoke("MediaRecorder error: what=$what extra=$extra", "media-recorder")
            }
            rec.prepare()
            rec.start()
        } catch (e: Exception) {
            try { rec.release() } catch (_: Exception) {}
            transition(State.ERROR)
            onError?.invoke("MediaRecorder.prepare/start failed: ${e.message}", "start")
            return
        }

        recorder = rec
        segmentStartNs = SystemClock.elapsedRealtimeNanos()
        transition(State.RECORDING)
        scheduleMeterPoll()
    }

    /**
     * Pick the right `MediaRecorder` container + encoder for the current
     * `outputFormat`. Opus needs API 29+, falls back to AAC with a warning
     * on older devices.
     */
    private fun applyMediaRecorderFormat(rec: MediaRecorder) {
        when (outputFormat.lowercase()) {
            "opus" -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    rec.setOutputFormat(MediaRecorder.OutputFormat.OGG)
                    rec.setAudioEncoder(MediaRecorder.AudioEncoder.OPUS)
                } else {
                    onError?.invoke(
                        "Opus output requires Android 10 (API 29+); falling back to m4a",
                        "format-unsupported"
                    )
                    rec.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                    rec.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                }
            }
            else -> {
                rec.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                rec.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            }
        }
    }

    /** WAV path: spin up an `AudioRecord` + PCM writer + meter polling. */
    private fun startWavRecording(file: File) {
        val wav = try {
            WavRecording(
                file = file,
                sampleRate = sampleRate,
                channels = channels.coerceIn(1, 2)
            )
        } catch (e: Exception) {
            transition(State.ERROR)
            onError?.invoke("Failed to open AudioRecord: ${e.message}", "start")
            return
        }
        try {
            wav.start()
        } catch (e: Exception) {
            wav.stop(deleteFile = true)
            transition(State.ERROR)
            onError?.invoke("AudioRecord.start failed: ${e.message}", "start")
            return
        }
        wavRecord = wav
        segmentStartNs = SystemClock.elapsedRealtimeNanos()
        transition(State.RECORDING)
        scheduleMeterPoll()
    }

    fun pause() {
        if (state != State.RECORDING) return
        if (outputFormat.equals("wav", ignoreCase = true)) {
            wavRecord?.pause()
            inProgressSegmentMs = segmentDurationMs()
            durationMs = completedSegmentsDurationMs + inProgressSegmentMs
            stopMeterPoll()
            transition(State.PAUSED)
            return
        }
        val rec = recorder ?: return
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
            // pause() requires API 24+. On older devices treat pause as a
            // "freeze" — stop polling and accept resume() needs a fresh
            // start(). Library minSdk is 24 so this is defensive only.
            stopMeterPoll()
            transition(State.PAUSED)
            return
        }
        try {
            rec.pause()
        } catch (e: Exception) {
            Log.e(TAG, "pause failed", e)
            return
        }
        inProgressSegmentMs = segmentDurationMs()
        durationMs = completedSegmentsDurationMs + inProgressSegmentMs
        stopMeterPoll()
        transition(State.PAUSED)
    }

    /**
     * Resume from `PAUSED` (continues writing to the same file) OR from
     * `BETWEEN_SEGMENTS` (opens a new file).
     */
    fun resume() {
        if (state == State.PAUSED) {
            if (outputFormat.equals("wav", ignoreCase = true)) {
                try {
                    wavRecord?.resume()
                } catch (e: Exception) {
                    transition(State.ERROR)
                    onError?.invoke("AudioRecord.resume() failed: ${e.message}", "resume")
                    return
                }
                segmentStartNs = SystemClock.elapsedRealtimeNanos()
                transition(State.RECORDING)
                scheduleMeterPoll()
                return
            }
            val rec = recorder ?: return
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return
            try {
                rec.resume()
            } catch (e: Exception) {
                transition(State.ERROR)
                onError?.invoke("MediaRecorder.resume() failed: ${e.message}", "resume")
                return
            }
            segmentStartNs = SystemClock.elapsedRealtimeNanos()
            transition(State.RECORDING)
            scheduleMeterPoll()
            return
        }
        if (state == State.BETWEEN_SEGMENTS) {
            start()
        }
    }

    /**
     * Finalise the in-progress segment and append it to `segments`. Leaves
     * the engine in `BETWEEN_SEGMENTS`. Returns the finalised file (or null
     * if nothing was recording).
     */
    fun pauseAndFinalizeSegment(): File? {
        if (state == State.RECORDING) {
            pause()
        }
        if (state != State.PAUSED) return null
        val file = currentSegmentFile ?: return null

        completedSegmentsDurationMs += inProgressSegmentMs
        durationMs = completedSegmentsDurationMs
        inProgressSegmentMs = 0

        if (outputFormat.equals("wav", ignoreCase = true)) {
            try {
                wavRecord?.stop(deleteFile = false)
            } catch (e: Exception) {
                Log.w(TAG, "WavRecording.stop() during finalise threw", e)
            }
            wavRecord = null
        } else {
            val rec = recorder
            try {
                rec?.stop()
            } catch (e: Exception) {
                Log.w(TAG, "MediaRecorder.stop() during finalise threw", e)
            }
            releaseRecorder()
        }
        currentSegmentFile = null

        if (file.exists() && file.length() > 0) {
            segments.add(file)
        }
        transition(State.BETWEEN_SEGMENTS)
        return file.takeIf { it.exists() && it.length() > 0 }
    }

    /**
     * Snapshot used by the view impl when entering preview. Returns a URL
     * suitable for playback (single segment when there's one, an async
     * concatenation otherwise). Callback fires on main.
     */
    fun snapshotForPreview(callback: (uri: String?, error: String?) -> Unit) {
        if (segments.size == 1) {
            val only = segments.first()
            if (only.exists() && only.length() > 0) {
                callback(fileUri(only), null)
            } else {
                callback(null, "Preview snapshot: segment missing on disk")
            }
            return
        }
        if (segments.isEmpty()) {
            callback(null, "No segments to preview")
            return
        }
        concatenateSegments(segments.toList()) { result ->
            when (result) {
                is ConcatResult.Success -> callback(fileUri(result.file), null)
                is ConcatResult.Failure -> callback(null, result.message)
            }
        }
    }

    /**
     * Finalise everything, concatenate segments if needed, and fire
     * `onComplete` once the file is written. From `BETWEEN_SEGMENTS` the
     * concatenation happens immediately; from `RECORDING` / `PAUSED` we
     * finalise the in-progress segment first.
     */
    fun stopFinalize() {
        if (state == State.RECORDING || state == State.PAUSED) {
            pauseAndFinalizeSegment()
        }
        if (segments.isEmpty()) {
            // Nothing recorded — surface a stopped state without emitting
            // a phantom onComplete (mirrors iOS).
            transition(State.STOPPED)
            return
        }
        val peak = peakAmplitude
        val history = amplitudeHistory.toFloatArray()
        val finalMs = durationMs
        val mime = mimeForFormat()
        if (segments.size == 1) {
            val only = segments.first()
            transition(State.STOPPED)
            if (only.exists()) {
                onComplete?.invoke(
                    fileUri(only),
                    finalMs,
                    only.length().toInt(),
                    mime,
                    peak,
                    history
                )
            }
            return
        }
        // Async concat — keep `state` at BETWEEN_SEGMENTS until the muxer
        // finishes, then flip to STOPPED and emit onComplete.
        concatenateSegments(segments.toList()) { result ->
            transition(State.STOPPED)
            when (result) {
                is ConcatResult.Success -> {
                    val out = result.file
                    onComplete?.invoke(
                        fileUri(out),
                        finalMs,
                        out.length().toInt(),
                        mime,
                        peak,
                        history
                    )
                }
                is ConcatResult.Failure -> {
                    onError?.invoke(result.message, "concat")
                    // Fall back to first segment so the user doesn't lose
                    // all their audio if the muxer blows up.
                    val first = segments.firstOrNull()
                    if (first != null && first.exists()) {
                        onComplete?.invoke(
                            fileUri(first),
                            finalMs,
                            first.length().toInt(),
                            mime,
                            peak,
                            history
                        )
                    }
                }
            }
        }
    }

    /** Discard the entire session, delete all segment files, return to IDLE. */
    fun cancel() {
        stopMeterPoll()
        val inProgress = currentSegmentFile
        try { recorder?.stop() } catch (_: Exception) {}
        releaseRecorder()
        try { wavRecord?.stop(deleteFile = true) } catch (_: Exception) {}
        wavRecord = null
        for (f in segments) {
            try { f.delete() } catch (_: Exception) {}
        }
        try { inProgress?.delete() } catch (_: Exception) {}
        segments.clear()
        currentSegmentFile = null
        completedSegmentsDurationMs = 0
        inProgressSegmentMs = 0
        durationMs = 0
        peakAmplitude = 0f
        amplitudeHistory.clear()
        transition(State.IDLE)
    }

    fun reset() {
        cancel()
    }

    // ---------- Internal helpers ----------

    private fun createMediaRecorder(): MediaRecorder {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            MediaRecorder(context)
        } else {
            @Suppress("DEPRECATION")
            MediaRecorder()
        }
    }

    /** Round the requested bitrate into a sensible per-quality range. */
    private fun quantizeBitrate(requested: Int, quality: String): Int {
        val (low, high) = when (quality.lowercase()) {
            "low" -> 32_000 to 64_000
            "medium" -> 64_000 to 128_000
            else -> 96_000 to 256_000
        }
        if (requested <= 0) return high
        return requested.coerceIn(low, high)
    }

    private fun resolveSegmentFile(isFreshSession: Boolean): File {
        val ext = fileExtension()
        // First segment honours the host-provided `outputFile`. Follow-up
        // segments live next to it with a `_segN` suffix so the host
        // resolver still controls the target directory.
        if (isFreshSession) {
            outputFile?.let { return it }
            return File(context.cacheDir, "wfr_${System.currentTimeMillis()}_seg1.$ext")
        }
        val base = outputFile
        if (base != null) {
            val parent = base.parentFile ?: context.cacheDir
            val stem = base.nameWithoutExtension
            val n = segments.size + 1
            return File(parent, "${stem}_seg${n}.$ext")
        }
        val n = segments.size + 1
        return File(context.cacheDir, "wfr_${System.currentTimeMillis()}_seg${n}.$ext")
    }

    /** Extension used for new segment files based on `outputFormat`. */
    private fun fileExtension(): String = when (outputFormat.lowercase()) {
        "wav" -> "wav"
        "opus" -> "ogg"
        else -> "m4a"
    }

    /** Mime type emitted on `onComplete` based on `outputFormat`. */
    private fun mimeForFormat(): String = when (outputFormat.lowercase()) {
        "wav" -> "audio/wav"
        "opus" -> "audio/ogg"
        else -> "audio/mp4"
    }

    /**
     * Append a new amplitude sample to `amplitudeHistory`, stride-merging
     * (max of each pair) once we hit `MAX_AMPLITUDE_HISTORY` so multi-hour
     * sessions don't grow the array unboundedly. Max (vs mean) preserves
     * peak energy that the 64-bucket downsampler then re-bucketises.
     */
    private fun appendAmplitudeBounded(value: Float) {
        amplitudeHistory.add(value)
        if (amplitudeHistory.size <= MAX_AMPLITUDE_HISTORY) return
        val compacted = ArrayList<Float>(MAX_AMPLITUDE_HISTORY)
        var i = 0
        while (i + 1 < amplitudeHistory.size) {
            compacted.add(max(amplitudeHistory[i], amplitudeHistory[i + 1]))
            i += 2
        }
        if (i < amplitudeHistory.size) compacted.add(amplitudeHistory[i])
        amplitudeHistory.clear()
        amplitudeHistory.addAll(compacted)
    }

    /**
     * Silence-detector state machine. Tracks the timestamp of the most
     * recent "loud" tick and fires `onSilenceDetected` (at most once per
     * silence window) when the gap exceeds `silenceTimeoutMs`. A subsequent
     * loud sample re-arms the detector so the next gap can fire again.
     */
    private fun observeSilence(db: Float) {
        if (silenceTimeoutMs <= 0) {
            lastLoudNs = 0L
            silenceFiredForThisWindow = false
            return
        }
        val now = SystemClock.elapsedRealtimeNanos()
        if (db >= silenceThresholdDb) {
            lastLoudNs = now
            silenceFiredForThisWindow = false
            return
        }
        if (lastLoudNs == 0L) {
            lastLoudNs = now
            return
        }
        val elapsedMs = ((now - lastLoudNs) / 1_000_000L).toInt()
        if (elapsedMs >= silenceTimeoutMs && !silenceFiredForThisWindow) {
            silenceFiredForThisWindow = true
            onSilenceDetected?.invoke(elapsedMs)
            if (autoStopOnSilence) stopFinalize()
        }
    }

    private fun segmentDurationMs(): Int {
        return if (state == State.RECORDING) {
            val segmentMs = ((SystemClock.elapsedRealtimeNanos() - segmentStartNs) / 1_000_000L).toInt()
            inProgressSegmentMs + segmentMs
        } else {
            inProgressSegmentMs
        }
    }

    private fun currentDurationMs(): Int {
        return completedSegmentsDurationMs + segmentDurationMs()
    }

    private fun releaseRecorder() {
        try { recorder?.reset() } catch (_: Exception) {}
        try { recorder?.release() } catch (_: Exception) {}
        recorder = null
    }

    private fun transition(newState: State) {
        if (state == newState) return
        state = newState
        onStateChange?.invoke()
    }

    private fun scheduleMeterPoll() {
        mainHandler.removeCallbacks(meterRunnable)
        mainHandler.post(meterRunnable)
    }

    private fun stopMeterPoll() {
        mainHandler.removeCallbacks(meterRunnable)
    }

    private fun fileUri(file: File): String = "file://${file.absolutePath}"

    // ---------- Concatenation ----------

    private sealed class ConcatResult {
        data class Success(val file: File) : ConcatResult()
        data class Failure(val message: String) : ConcatResult()
    }

    /**
     * Concatenate a list of m4a files into a single m4a using `MediaMuxer`
     * + `MediaExtractor`. Async — callback fires on main.
     *
     * This is a sample-level concat (no re-encoding) so it's fast even for
     * long recordings. Assumes every segment uses the same encoder /
     * sample-rate / channel layout — which is always the case here since we
     * own the MediaRecorder configuration.
     */
    private fun concatenateSegments(
        urls: List<File>,
        callback: (ConcatResult) -> Unit
    ) {
        val ext = fileExtension()
        val out = File(
            context.cacheDir,
            "wfr_concat_${System.currentTimeMillis()}.$ext"
        )
        Thread({
            val result = try {
                if (outputFormat.equals("wav", ignoreCase = true)) {
                    concatWavSegments(urls, out)
                } else {
                    doMuxConcat(urls, out)
                }
                ConcatResult.Success(out)
            } catch (e: Exception) {
                Log.e(TAG, "concat failed", e)
                try { out.delete() } catch (_: Exception) {}
                ConcatResult.Failure(e.message ?: "Concat failed")
            }
            mainHandler.post { callback(result) }
        }, "waveformrecorder-concat").apply {
            isDaemon = true
        }.start()
    }

    /**
     * Concatenate a list of canonical WAV files (44-byte RIFF header + PCM)
     * by stripping the headers from segments 2..N, appending the raw PCM
     * payloads, and writing a fresh canonical header at the front.
     */
    private fun concatWavSegments(urls: List<File>, out: File) {
        var sampleRate = 0
        var channels: Short = 0
        var bitsPerSample: Short = 0
        val totalPcm = mutableListOf<ByteArray>()
        for (file in urls) {
            if (!file.exists() || file.length() < 44L) continue
            val bytes = file.readBytes()
            if (sampleRate == 0) {
                // Pull the fmt parameters off the first segment.
                sampleRate = ByteBuffer.wrap(bytes, 24, 4)
                    .order(ByteOrder.LITTLE_ENDIAN).int
                channels = ByteBuffer.wrap(bytes, 22, 2)
                    .order(ByteOrder.LITTLE_ENDIAN).short
                bitsPerSample = ByteBuffer.wrap(bytes, 34, 2)
                    .order(ByteOrder.LITTLE_ENDIAN).short
            }
            // Skip the 44-byte canonical header. All segments come from our
            // own writer, so the header is always exactly 44 bytes.
            totalPcm.add(bytes.copyOfRange(44, bytes.size))
        }
        val pcmLength = totalPcm.sumOf { it.size }
        FileOutputStream(out).use { fos ->
            fos.write(buildWavHeader(pcmLength, sampleRate, channels.toInt(), bitsPerSample.toInt()))
            for (chunk in totalPcm) {
                fos.write(chunk)
            }
        }
        if (!out.exists() || out.length() == 0L) {
            throw RuntimeException("WAV concat produced empty file")
        }
    }

    private fun doMuxConcat(urls: List<File>, out: File) {
        val muxer = MediaMuxer(out.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
        var audioTrack = -1
        var formatSet = false
        var timeOffsetUs = 0L
        val buffer = ByteBuffer.allocateDirect(256 * 1024)
        val info = MediaCodec.BufferInfo()
        try {
            for (file in urls) {
                if (!file.exists() || file.length() == 0L) continue
                val extractor = MediaExtractor()
                try {
                    extractor.setDataSource(file.absolutePath)
                    var src = -1
                    var format: MediaFormat? = null
                    for (i in 0 until extractor.trackCount) {
                        val f = extractor.getTrackFormat(i)
                        val mime = f.getString(MediaFormat.KEY_MIME) ?: continue
                        if (mime.startsWith("audio/")) {
                            src = i
                            format = f
                            break
                        }
                    }
                    if (src < 0 || format == null) continue
                    extractor.selectTrack(src)

                    if (!formatSet) {
                        audioTrack = muxer.addTrack(format)
                        muxer.start()
                        formatSet = true
                    }

                    var maxPts = 0L
                    while (true) {
                        buffer.clear()
                        val size = extractor.readSampleData(buffer, 0)
                        if (size < 0) break
                        val pts = extractor.sampleTime
                        info.offset = 0
                        info.size = size
                        info.presentationTimeUs = timeOffsetUs + pts
                        info.flags = extractor.sampleFlags
                        muxer.writeSampleData(audioTrack, buffer, info)
                        if (pts > maxPts) maxPts = pts
                        extractor.advance()
                    }
                    // Bump the offset so the next segment is placed *after*
                    // the last sample of this one. We use the highest PTS we
                    // saw + a 1ms guard to avoid timestamp collisions on the
                    // muxer boundary.
                    timeOffsetUs += maxPts + 1000L
                } finally {
                    extractor.release()
                }
            }
        } finally {
            if (formatSet) {
                try { muxer.stop() } catch (_: Exception) {}
            }
            try { muxer.release() } catch (_: Exception) {}
        }
        if (!out.exists() || out.length() == 0L) {
            throw RuntimeException("Concat produced an empty file")
        }
    }

    /** Build a 44-byte canonical RIFF/WAVE header for 16-bit PCM data. */
    private fun buildWavHeader(
        pcmDataLength: Int,
        sampleRate: Int,
        channels: Int,
        bitsPerSample: Int
    ): ByteArray {
        val byteRate = sampleRate * channels * (bitsPerSample / 8)
        val blockAlign = channels * (bitsPerSample / 8)
        val totalSize = 36 + pcmDataLength
        val header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN)
        header.put("RIFF".toByteArray(Charsets.US_ASCII))
        header.putInt(totalSize)
        header.put("WAVE".toByteArray(Charsets.US_ASCII))
        header.put("fmt ".toByteArray(Charsets.US_ASCII))
        header.putInt(16)               // fmt chunk size
        header.putShort(1)              // PCM format
        header.putShort(channels.toShort())
        header.putInt(sampleRate)
        header.putInt(byteRate)
        header.putShort(blockAlign.toShort())
        header.putShort(bitsPerSample.toShort())
        header.put("data".toByteArray(Charsets.US_ASCII))
        header.putInt(pcmDataLength)
        return header.array()
    }

    /**
     * Encapsulates the AudioRecord + writer thread used by the WAV code
     * path. Pause / resume just toggle the writer thread's `paused` flag —
     * the AudioRecord stays open and discards unread samples.
     *
     * The PCM payload is written to the on-disk file as it arrives, and the
     * 44-byte WAV header at offset 0 is rewritten on `stop()` so the file
     * is playable as soon as the writer thread joins.
     */
    private inner class WavRecording(
        val file: File,
        val sampleRate: Int,
        val channels: Int
    ) {
        private val bufferSize: Int
        private val recorder: AudioRecord
        private var writerThread: Thread? = null
        @Volatile private var running = false
        @Volatile private var paused = false
        @Volatile private var bytesWritten = 0
        @Volatile var lastPeakLinear: Float = 0f
            private set

        init {
            val channelConfig = if (channels == 2) {
                AudioFormat.CHANNEL_IN_STEREO
            } else {
                AudioFormat.CHANNEL_IN_MONO
            }
            val computed = AudioRecord.getMinBufferSize(
                sampleRate,
                channelConfig,
                AudioFormat.ENCODING_PCM_16BIT
            )
            // getMinBufferSize returns -2/-3 on failure; fall back to a sane
            // 100ms buffer so AudioRecord doesn't refuse to start.
            bufferSize = if (computed > 0) computed * 2 else sampleRate * 2 * channels / 5
            // Permission has already been verified by the caller via
            // `hasMicrophonePermission` — AudioRecord won't throw here so
            // long as the manifest declares RECORD_AUDIO.
            try {
                recorder = AudioRecord(
                    android.media.MediaRecorder.AudioSource.MIC,
                    sampleRate,
                    channelConfig,
                    AudioFormat.ENCODING_PCM_16BIT,
                    bufferSize
                )
            } catch (e: SecurityException) {
                throw e
            }
        }

        fun start() {
            // Reserve the first 44 bytes for the header — we rewrite them
            // when stop() runs.
            FileOutputStream(file).use { it.write(ByteArray(44)) }
            recorder.startRecording()
            running = true
            paused = false
            bytesWritten = 0
            writerThread = Thread({
                writerLoop()
            }, "waveformrecorder-wav-writer").apply {
                isDaemon = true
                start()
            }
        }

        private fun writerLoop() {
            val buf = ByteArray(bufferSize)
            // Re-bundle reads from AudioRecord into chunks of roughly
            // `pcmChunkMs` worth of audio so the JS bridge sees one event
            // per chunk rather than one per AudioRecord pull.
            val streamingEnabled = enablePcmStream
            val streamChunkBytes = if (streamingEnabled) {
                val ms = pcmChunkMs.coerceAtLeast(20)
                ((sampleRate * channels * 2L * ms) / 1000L)
                    .coerceAtLeast(bufferSize.toLong())
                    .toInt()
            } else 0
            var accum: java.io.ByteArrayOutputStream? = if (streamingEnabled) {
                java.io.ByteArrayOutputStream(streamChunkBytes)
            } else null
            try {
                RandomAccessFile(file, "rw").use { raf ->
                    raf.seek(44L) // Skip the reserved header bytes.
                    while (running) {
                        if (paused) {
                            Thread.sleep(20)
                            continue
                        }
                        val read = recorder.read(buf, 0, buf.size)
                        if (read <= 0) continue
                        raf.write(buf, 0, read)
                        bytesWritten += read
                        var peak = 0
                        var i = 0
                        while (i + 1 < read) {
                            val lo = buf[i].toInt() and 0xff
                            val hi = buf[i + 1].toInt()
                            val sample = (hi shl 8) or lo
                            val abs = if (sample < 0) -sample else sample
                            if (abs > peak) peak = abs
                            i += 2
                        }
                        lastPeakLinear = (peak.toFloat() / 32767f).coerceIn(0f, 1f)

                        if (streamingEnabled) {
                            val out = accum!!
                            out.write(buf, 0, read)
                            if (out.size() >= streamChunkBytes) {
                                emitPcmChunk(out.toByteArray())
                                out.reset()
                            }
                        }
                    }
                    // Flush any tail samples once we're stopping.
                    if (streamingEnabled) {
                        val out = accum!!
                        if (out.size() > 0) {
                            emitPcmChunk(out.toByteArray())
                            out.reset()
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "WAV writer crashed", e)
            }
        }

        private fun emitPcmChunk(bytes: ByteArray) {
            val cb = onPcmChunk ?: return
            val b64 = android.util.Base64.encodeToString(
                bytes,
                android.util.Base64.NO_WRAP
            )
            val ts = completedSegmentsDurationMs + segmentDurationMs()
            cb(b64, sampleRate, channels, 2, ts)
        }

        fun pause() {
            paused = true
        }
        fun resume() {
            paused = false
        }

        /** Stop recording, finalise the WAV header, optionally delete the file. */
        fun stop(deleteFile: Boolean) {
            running = false
            try { recorder.stop() } catch (_: Exception) {}
            try { recorder.release() } catch (_: Exception) {}
            try { writerThread?.join(200) } catch (_: Exception) {}
            writerThread = null
            if (deleteFile) {
                try { file.delete() } catch (_: Exception) {}
                return
            }
            // Rewrite the 44-byte header in place now that we know the
            // final PCM length. Mirrors the layout produced by AVAudioRecorder.
            try {
                val header = buildWavHeader(
                    pcmDataLength = bytesWritten,
                    sampleRate = sampleRate,
                    channels = channels,
                    bitsPerSample = 16
                )
                RandomAccessFile(file, "rw").use { raf ->
                    raf.seek(0L)
                    raf.write(header)
                }
            } catch (e: Exception) {
                Log.e(TAG, "WAV header finalise failed", e)
            }
        }
    }

    companion object {
        private const val TAG = "WaveformRecEngine"
        private const val MAX_AMPLITUDE_HISTORY = 16384
    }
}
