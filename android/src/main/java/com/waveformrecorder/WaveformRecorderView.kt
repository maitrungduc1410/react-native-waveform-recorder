package com.waveformrecorder

import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.AttributeSet
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.widget.FrameLayout
import android.widget.TextView
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.sqrt

/**
 * Native composite [FrameLayout] wrapped by the Fabric view manager
 * ([WaveformRecorderViewManager]).
 *
 * Layout: a rounded background + (optional preview play button) + waveform
 * bars + (optional) time label, arranged horizontally so the component
 * drops cleanly into any keyboard / input-bar context.
 *
 * Owns:
 *   * [AudioRecorderEngine]  — recorder + segment list + concat
 *   * [AudioPlayerEngine]    — preview-state playback
 *   * [WaveformBarsView]     — render
 *   * [PlayPauseButton]      — preview-state play/pause overlay
 *   * [TextView]             — timer
 *
 * Composite state machine (mirrors the public state):
 *
 *   idle ⇄ recording ⇄ paused ⇄ preview
 *        \                ↓        ↓
 *         stopped ─── stop() ──────┘
 */
class WaveformRecorderView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
    defStyleAttr: Int = 0
) : FrameLayout(context, attrs, defStyleAttr) {

    // region Composite state ---------------------------------------------------

    enum class CompositeState { IDLE, RECORDING, PAUSED, PREVIEW, STOPPED, ERROR }

    private var compositeState: CompositeState = CompositeState.IDLE
        set(value) {
            if (field == value) return
            field = value
            updatePlayButtonVisibility()
            requestLayout()
            emitStateChange()
        }

    // endregion

    // region Subviews ----------------------------------------------------------

    private val backgroundDrawable = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        setColor(Color.parseColor("#3478F6"))
    }
    private val barsView: WaveformBarsView = WaveformBarsView(context)
    private val timeLabel: TextView = TextView(context).apply {
        setTextColor(Color.WHITE)
        textSize = 13f
        gravity = Gravity.CENTER
        setTypeface(typeface, android.graphics.Typeface.BOLD)
        text = "0:00"
    }
    private val playButton: PlayPauseButton = PlayPauseButton(context).apply {
        // INVISIBLE (not GONE) so FrameLayout still measures the button +
        // its internal ImageView on the first measure pass. Otherwise,
        // transitioning to PREVIEW later flips visibility to VISIBLE but
        // leaves the inner views at their unmeasured 0x0 size — the
        // button takes up no pixels and the icon never appears.
        visibility = View.INVISIBLE
    }

    // endregion

    // region Engines -----------------------------------------------------------

    private val engine: AudioRecorderEngine = AudioRecorderEngine(context.applicationContext)
    private val playerEngine: AudioPlayerEngine = AudioPlayerEngine()
    private val previewProgressHandler = Handler(Looper.getMainLooper())
    private var isScrubbing = false
    private var resumeAfterScrub = false
    /**
     * Concat URI returned by [AudioRecorderEngine.snapshotForPreview] for
     * multi-segment recordings. We track it explicitly so the temp file
     * in the cache directory can be deleted when the preview cycle ends —
     * the engine only owns segment files, not the concat we synthesised
     * for the preview player.
     */
    private var previewUri: String? = null
    /**
     * Bumped by every command that supersedes an in-flight `enterPreview`
     * snapshot (cancel / exit / stop / resume / teardown / a follow-up
     * enterPreview). The snapshot completion lambda captures the value
     * at entry and bails if the counter has advanced — without this, a
     * multi-segment concat that finishes after the user has moved on
     * would smuggle the view back into PREVIEW state.
     */
    private var previewToken: Int = 0

    // endregion

    // region Public callbacks (set by the Fabric view manager) -----------------

    /** (state, durationMs). */
    var onStateChange: ((String, Int) -> Unit)? = null
    /** (amplitude, peak, db). */
    var onMeter: ((Float, Float, Float) -> Unit)? = null
    var onComplete: (
        (uri: String,
         durationMs: Int,
         format: String,
         mimeType: String,
         sizeBytes: Int,
         sampleRate: Int,
         channels: Int,
         samples: FloatArray,
         peakAmplitude: Float) -> Unit
    )? = null
    var onMaxDurationReached: (() -> Unit)? = null
    var onPermissionDenied: (() -> Unit)? = null
    var onError: ((String, String?) -> Unit)? = null
    /** (positionMs). */
    var onSeek: ((Int) -> Unit)? = null
    /** (positionMs, durationMs). */
    var onPlaybackTimeUpdate: ((Int, Int) -> Unit)? = null
    /** v0.3 — (cancelProgress 0..1, lockProgress 0..1). */
    var onSlideProgress: ((Float, Float) -> Unit)? = null
    var onSlideCancel: (() -> Unit)? = null
    var onSlideLock: (() -> Unit)? = null
    /** v0.3 — (elapsedSilenceMs). */
    var onSilenceDetected: ((Int) -> Unit)? = null
    /** v1.0 — (base64Chunk, sampleRate, channels, bytesPerSample, timestampMs). */
    var onPcmChunk: ((String, Int, Int, Int, Int) -> Unit)? = null

    // endregion

    // region Reactive props (set by the Fabric view manager) -------------------

    var outputUri: String = ""
        set(value) {
            field = value
            engine.outputFile = if (value.isBlank()) {
                null
            } else {
                val path = if (value.startsWith("file://")) value.removePrefix("file://") else value
                java.io.File(path)
            }
        }

    var outputFormat: String = "m4a"
        set(value) {
            field = value
            engine.outputFormat = value
        }
    var outputSampleRate: Int = 44100
        set(value) { field = value; engine.sampleRate = value }
    var outputChannels: Int = 1
        set(value) { field = value; engine.channels = value }
    var outputBitrate: Int = 128_000
        set(value) { field = value; engine.bitrate = value }
    var outputQuality: String = "high"
        set(value) { field = value; engine.quality = value }

    var maxDurationMs: Int = 0
        set(value) { field = value; engine.maxDurationMs = value }
    var minDurationMs: Int = 0

    var containerBackgroundColor: Int = Color.parseColor("#3478F6")
        set(value) {
            field = value
            backgroundDrawable.setColor(value)
            if (showBackground) background = backgroundDrawable
        }
    var containerBorderRadiusDp: Float = 16f
        set(value) {
            field = value
            backgroundDrawable.cornerRadius = value * resources.displayMetrics.density
        }
    var showBackground: Boolean = true
        set(value) {
            field = value
            background = if (value) backgroundDrawable else null
        }

    var showTime: Boolean = true
        set(value) {
            field = value
            timeLabel.visibility = if (value) View.VISIBLE else View.GONE
            requestLayout()
        }
    var timeColor: Int = Color.WHITE
        set(value) { field = value; timeLabel.setTextColor(value) }
    var timeMode: String = "count-up"
        set(value) { field = value; updateTimeLabel() }

    var samplesPerSecond: Int = 12
        set(value) {
            field = value
            barsView.samplesPerSecond = value.coerceIn(1, 120)
        }
    var meterUpdatesPerSecond: Int = 30
        set(value) {
            field = value
            engine.meterUpdatesPerSecond = value
        }

    var enablePreview: Boolean = true
    var enableContinueRecording: Boolean = true
    var showPlayButton: Boolean = true
        set(value) {
            field = value
            updatePlayButtonVisibility()
            requestLayout()
        }
    var playButtonColor: Int = Color.WHITE
        set(value) {
            field = value
            playButton.iconColor = value
        }

    // v0.3 — slide-to-cancel / slide-to-lock gestures
    var enableSlideToCancel: Boolean = false
    var slideToCancelThresholdDp: Float = 80f
    var enableSlideToLock: Boolean = false
    var slideToLockThresholdDp: Float = 80f

    // v0.3 — silence detection (forwarded straight to the engine).
    var silenceThresholdDb: Float = -160f
        set(value) { field = value; engine.silenceThresholdDb = value }
    var silenceTimeoutMs: Int = 0
        set(value) { field = value; engine.silenceTimeoutMs = value }
    var autoStopOnSilence: Boolean = false
        set(value) { field = value; engine.autoStopOnSilence = value }

    // v1.0 — background recording (controlled by [WaveformRecorderBackgroundService]).
    var backgroundRecording: Boolean = false
    var backgroundNotificationTitle: String = "Recording"
    var backgroundNotificationBody: String = "Microphone recording in progress."

    // v1.0 — raw-PCM streaming (forwarded to the engine; WAV path only).
    var enablePcmStream: Boolean = false
        set(value) { field = value; engine.enablePcmStream = value }
    var pcmChunkMs: Int = 200
        set(value) { field = value; engine.pcmChunkMs = value }

    /** `auto` = uncontrolled. */
    var controlledState: String = "auto"
        set(value) {
            field = value
            applyControlledState()
        }

    // endregion

    // region Internal ---------------------------------------------------------

    private var lastEmittedState: String = ""
    private var lastVisualSampleNs: Long = 0L

    // v0.3 — slide-to-cancel / slide-to-lock pan tracking
    private var slideActive: Boolean = false
    private var slideStartX: Float = 0f
    private var slideStartY: Float = 0f
    private var slideHasFiredCancel: Boolean = false
    private var slideHasFiredLock: Boolean = false
    private val slideTouchSlop: Int = ViewConfiguration.get(context).scaledTouchSlop

    init {
        backgroundDrawable.cornerRadius = containerBorderRadiusDp * resources.displayMetrics.density
        background = backgroundDrawable

        addView(
            barsView,
            LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT, Gravity.CENTER)
        )
        addView(
            timeLabel,
            LayoutParams(
                dp(48),
                LayoutParams.MATCH_PARENT,
                Gravity.END or Gravity.CENTER_VERTICAL
            )
        )
        addView(
            playButton,
            LayoutParams(dp(32), dp(32), Gravity.START or Gravity.CENTER_VERTICAL)
        )

        playButton.setOnClickListener { handlePlayButtonClick() }

        barsView.onScrubBegan = { f -> handleScrubBegan(f) }
        barsView.onScrubMoved = { f -> handleScrubMoved(f) }
        barsView.onScrubEnded = { f, cancelled -> handleScrubEnded(f, cancelled) }

        wireEngineCallbacks()
    }

    override fun onInterceptTouchEvent(ev: MotionEvent): Boolean {
        // Only intercept while recording and at least one slide gesture is on.
        if (compositeState != CompositeState.RECORDING) return false
        if (!enableSlideToCancel && !enableSlideToLock) return false
        when (ev.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                slideStartX = ev.x
                slideStartY = ev.y
                slideHasFiredCancel = false
                slideHasFiredLock = false
                slideActive = false
                return false
            }
            MotionEvent.ACTION_MOVE -> {
                val dx = ev.x - slideStartX
                val dy = ev.y - slideStartY
                if (!slideActive && (abs(dx) >= slideTouchSlop || abs(dy) >= slideTouchSlop)) {
                    slideActive = true
                    return true
                }
            }
        }
        return false
    }

    override fun onTouchEvent(ev: MotionEvent): Boolean {
        if (compositeState != CompositeState.RECORDING) return super.onTouchEvent(ev)
        if (!enableSlideToCancel && !enableSlideToLock) return super.onTouchEvent(ev)
        when (ev.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                // onInterceptTouchEvent already captured the start point
                // when it returned true; this branch only runs if no child
                // ate the DOWN, in which case we initialise here too.
                slideStartX = ev.x
                slideStartY = ev.y
                slideHasFiredCancel = false
                slideHasFiredLock = false
                slideActive = true
                onSlideProgress?.invoke(0f, 0f)
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                if (!slideActive) return true
                val density = resources.displayMetrics.density
                val dxDp = (ev.x - slideStartX) / density
                val dyDp = (ev.y - slideStartY) / density
                // Cancel = drag toward the leading edge of the recorder UI
                // (left, -dx -> +progress).
                val cancelSign = -1f
                var cancelProgress = 0f
                if (enableSlideToCancel && slideToCancelThresholdDp > 0f) {
                    cancelProgress = (cancelSign * dxDp / slideToCancelThresholdDp).coerceIn(0f, 1f)
                }
                var lockProgress = 0f
                if (enableSlideToLock && slideToLockThresholdDp > 0f) {
                    lockProgress = ((-dyDp) / slideToLockThresholdDp).coerceIn(0f, 1f)
                }
                onSlideProgress?.invoke(cancelProgress, lockProgress)
                if (enableSlideToCancel && !slideHasFiredCancel &&
                    cancelProgress >= 1f && cancelProgress >= lockProgress
                ) {
                    slideHasFiredCancel = true
                    onSlideCancel?.invoke()
                    slideActive = false
                    return true
                }
                if (enableSlideToLock && !slideHasFiredLock && lockProgress >= 1f) {
                    slideHasFiredLock = true
                    onSlideLock?.invoke()
                    slideActive = false
                    return true
                }
                return true
            }
            MotionEvent.ACTION_UP,
            MotionEvent.ACTION_CANCEL -> {
                if (slideActive && !slideHasFiredCancel && !slideHasFiredLock) {
                    onSlideProgress?.invoke(0f, 0f)
                }
                slideActive = false
                slideHasFiredCancel = false
                slideHasFiredLock = false
                return true
            }
        }
        return super.onTouchEvent(ev)
    }

    override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
        super.onLayout(changed, left, top, right, bottom)
        val w = right - left
        val h = bottom - top
        val padding = dp(12)
        val timeWidth = if (showTime) dp(48) else 0
        val buttonVisible = compositeState == CompositeState.PREVIEW && showPlayButton
        val buttonSize = if (buttonVisible) dp(32) else 0
        val leftEdge = padding + (if (buttonSize > 0) buttonSize + dp(8) else 0)

        if (buttonVisible) {
            val centerY = (h - buttonSize) / 2
            playButton.layout(padding, centerY, padding + buttonSize, centerY + buttonSize)
        } else {
            playButton.layout(0, 0, 0, 0)
        }

        if (showTime) {
            val x = w - padding - timeWidth
            timeLabel.layout(x, 0, x + timeWidth, h)
        }

        val barsLeft = leftEdge
        val barsRight = w - padding - (if (timeWidth > 0) timeWidth + dp(8) else 0)
        barsView.layout(barsLeft, 0, barsRight, h)
    }

    // endregion

    // region Public proxies (called by view manager) ---------------------------

    fun setPlayedBarColor(color: Int) { barsView.playedBarColor = color }
    fun setUnplayedBarColor(color: Int) {
        barsView.unplayedBarColor = color
        if (barsView.futureBarColor == null) barsView.futureBarColor = null
    }
    fun setFutureBarColor(color: Int?) { barsView.futureBarColor = color }
    fun setBarWidthDp(dp: Float) {
        barsView.barWidthPx = dp * resources.displayMetrics.density
    }
    fun setBarGapDp(dp: Float) {
        barsView.barGapPx = dp * resources.displayMetrics.density
    }
    fun setBarRadiusDp(dp: Float) {
        barsView.barRadiusPx = if (dp >= 0f) dp * resources.displayMetrics.density else -1f
    }
    fun setRecordingMode(value: String) {
        barsView.recordingMode = when (value.lowercase()) {
            "morph" -> WaveformBarsView.RecordingMode.MORPH
            "centered" -> WaveformBarsView.RecordingMode.CENTERED
            else -> WaveformBarsView.RecordingMode.SCROLL
        }
    }
    fun setFutureBarStyle(value: String) {
        barsView.futureBarStyle = when (value.lowercase()) {
            "dot" -> WaveformBarsView.FutureBarStyle.DOT
            "line" -> WaveformBarsView.FutureBarStyle.LINE
            else -> WaveformBarsView.FutureBarStyle.HIDDEN
        }
    }
    fun setNewSampleEntry(value: String) {
        barsView.newSampleEntry = when (value.lowercase()) {
            "fade" -> WaveformBarsView.NewSampleEntry.FADE
            "none" -> WaveformBarsView.NewSampleEntry.NONE
            else -> WaveformBarsView.NewSampleEntry.GROW
        }
    }

    // endregion

    // region Commands ---------------------------------------------------------

    fun startCommand() {
        if (isControlled()) {
            emitStateChangeForce("recording", engine.durationMs)
            return
        }
        if (!engine.hasMicrophonePermission) {
            onPermissionDenied?.invoke()
            return
        }
        engine.start()
    }

    fun pauseCommand() {
        if (isControlled()) {
            emitStateChangeForce("paused", engine.durationMs)
            return
        }
        if (engine.state == AudioRecorderEngine.State.RECORDING) {
            engine.pause()
        }
    }

    fun resumeCommand() {
        if (isControlled()) {
            emitStateChangeForce("recording", engine.durationMs)
            return
        }
        // Supersede any in-flight enterPreview snapshot — the user is
        // explicitly asking to continue recording, not preview.
        previewToken++
        when (compositeState) {
            CompositeState.PAUSED -> engine.resume()
            CompositeState.PREVIEW -> {
                if (!enableContinueRecording) {
                    onError?.invoke(
                        "enableContinueRecording is false; resume() from preview is disabled",
                        "continue-disabled"
                    )
                    return
                }
                exitPreviewInternal()
                engine.resume() // from BETWEEN_SEGMENTS
            }
            else -> Unit
        }
    }

    fun stopCommand() {
        if (isControlled()) {
            emitStateChangeForce("stopped", engine.durationMs)
            return
        }
        // Supersede any in-flight enterPreview snapshot — the user is
        // ending the session, not waiting for a preview to appear.
        previewToken++
        val cur = engine.durationMs
        if (minDurationMs > 0 && cur < minDurationMs &&
            (compositeState == CompositeState.RECORDING || compositeState == CompositeState.PAUSED)
        ) {
            engine.cancel()
            onError?.invoke(
                "Recording cancelled: below minDurationMs ($cur/${minDurationMs}ms)",
                "min-duration"
            )
            return
        }
        if (compositeState == CompositeState.PREVIEW) {
            stopFromPreview()
            return
        }
        engine.stopFinalize()
    }

    fun cancelCommand() {
        if (isControlled()) {
            emitStateChangeForce("idle", engine.durationMs)
            return
        }
        // Supersede any in-flight enterPreview snapshot — the user is
        // discarding the session.
        previewToken++
        if (compositeState == CompositeState.PREVIEW) {
            exitPreviewInternal()
        }
        engine.cancel()
        compositeState = CompositeState.IDLE
    }

    fun enterPreviewCommand() {
        if (isControlled()) {
            emitStateChangeForce("preview", engine.durationMs)
            return
        }
        if (!enablePreview) {
            onError?.invoke(
                "enablePreview is false; enterPreview() is disabled",
                "preview-disabled"
            )
            return
        }
        engine.pauseAndFinalizeSegment()
        // Generation-counter guard: any intervening cancel / stop / resume /
        // exit / teardown / re-enter bumps `previewToken` so this lambda
        // becomes a no-op when it eventually fires (multi-segment concat
        // hops to a worker thread and can take seconds).
        val token = ++previewToken
        engine.snapshotForPreview { uri, err ->
            if (token != previewToken) {
                // Host has moved on — drop the concat file the snapshot
                // produced so it doesn't linger in caches.
                uri?.let { deleteIfTempConcat(it) }
                return@snapshotForPreview
            }
            if (err != null || uri == null) {
                onError?.invoke(err ?: "Preview snapshot returned no URL", "preview-snapshot")
                return@snapshotForPreview
            }
            // Drop any prior preview concat before overwriting the ref —
            // back-to-back re-entries would otherwise accumulate temp
            // files for every multi-segment cycle.
            previewUri?.let { deleteIfTempConcat(it) }
            previewUri = uri
            barsView.setPreviewAmplitudes(engine.amplitudeHistorySnapshot)
            barsView.isRecording = false
            barsView.progressFraction = 0f
            playerEngine.setSource(context.applicationContext, uri)
            compositeState = CompositeState.PREVIEW
        }
    }

    fun exitPreviewCommand() {
        if (isControlled()) {
            emitStateChangeForce("paused", engine.durationMs)
            return
        }
        // Supersede any in-flight enterPreview snapshot — the user is
        // exiting the preview state entirely.
        previewToken++
        exitPreviewInternal()
        compositeState = CompositeState.PAUSED
    }

    fun togglePreviewPlaybackCommand() {
        if (compositeState != CompositeState.PREVIEW) return
        playerEngine.toggle()
    }

    fun seekPreviewCommand(positionMs: Int) {
        if (compositeState != CompositeState.PREVIEW) return
        playerEngine.seekToMs(positionMs)
        val dur = playerEngine.durationMs
        barsView.progressFraction = if (dur > 0) positionMs.toFloat() / dur.toFloat() else 0f
        updateTimeLabel(currentMs = positionMs, durationMs = dur)
        onSeek?.invoke(positionMs)
    }

    fun tearDown() {
        // Supersede any in-flight enterPreview snapshot before we tear
        // down so the callback doesn't paint UI onto a recycled view.
        previewToken++
        previewProgressHandler.removeCallbacksAndMessages(null)
        engine.reset()
        playerEngine.reset()
        barsView.clearRecordingAmplitudes()
        barsView.setPreviewAmplitudes(FloatArray(0))
        timeLabel.text = "0:00"
        lastEmittedState = ""
        lastVisualSampleNs = 0L
        compositeState = CompositeState.IDLE
        previewUri?.let { deleteIfTempConcat(it) }
        previewUri = null
        WaveformRecorderBackgroundService.stop(context.applicationContext)
    }

    private fun isControlled(): Boolean =
        controlledState.isNotEmpty() && controlledState != "auto"

    /**
     * Start the host's foreground service so the OS keeps the mic alive
     * while the app is backgrounded. Idempotent — the service ignores
     * repeated `startForegroundService` calls.
     */
    private fun maybeStartBackgroundService() {
        if (!backgroundRecording) return
        WaveformRecorderBackgroundService.start(
            context.applicationContext,
            backgroundNotificationTitle,
            backgroundNotificationBody
        )
    }

    private fun exitPreviewInternal() {
        if (playerEngine.isPlaying) playerEngine.pause()
        playerEngine.reset()
        barsView.progressFraction = 0f
        // Switch back to "recording-style" rendering so the user sees the
        // bars. The isRecording setter wipes the ring buffer on
        // `false -> true` (it assumes a fresh recording session), so
        // re-seed it from the engine's amplitude history snapshot to
        // preserve the waveform the user just saw in preview.
        val history = engine.amplitudeHistorySnapshot
        barsView.isRecording = true
        barsView.setRecordingAmplitudes(history)
        // Multi-segment previews materialise a concat file in caches that
        // only this view layer references — drop it now so the next
        // preview cycle gets a fresh one.
        previewUri?.let { deleteIfTempConcat(it) }
        previewUri = null
    }

    private fun stopFromPreview() {
        if (playerEngine.isPlaying) playerEngine.pause()
        playerEngine.reset()
        // The preview's concat (if any) is independent from the file
        // stopFinalize() will produce, so release it here.
        previewUri?.let { deleteIfTempConcat(it) }
        previewUri = null
        // engine is in BETWEEN_SEGMENTS — stopFinalize() will concatenate.
        engine.stopFinalize()
    }

    /**
     * Best-effort delete for the temp concat file
     * [AudioRecorderEngine.snapshotForPreview] produces for multi-segment
     * recordings. Single-segment preview URIs alias a segment file owned
     * by the engine — those don't start with `wfr_concat_` and are
     * intentionally skipped here so the engine's own segment-cleanup
     * path stays the single source of truth.
     */
    private fun deleteIfTempConcat(uri: String) {
        val path = if (uri.startsWith("file://")) uri.removePrefix("file://") else return
        val file = java.io.File(path)
        if (!file.name.startsWith("wfr_concat_")) return
        try { file.delete() } catch (_: Exception) {}
    }

    // endregion

    // region Engine plumbing --------------------------------------------------

    private fun wireEngineCallbacks() {
        engine.onStateChange = {
            when (engine.state) {
                AudioRecorderEngine.State.RECORDING -> {
                    barsView.isRecording = true
                    compositeState = CompositeState.RECORDING
                    maybeStartBackgroundService()
                }
                AudioRecorderEngine.State.PAUSED,
                AudioRecorderEngine.State.BETWEEN_SEGMENTS -> {
                    barsView.isRecording = true
                    compositeState = CompositeState.PAUSED
                }
                AudioRecorderEngine.State.STOPPED -> {
                    // Flip out of "live recording" mode so the scroll loop
                    // stops, but keep the ring buffer so the waveform stays
                    // frozen on screen (matches the duration label staying
                    // visible). Cleared explicitly on the next start() /
                    // cancel() / tearDown().
                    barsView.isRecording = false
                    compositeState = CompositeState.STOPPED
                    WaveformRecorderBackgroundService.stop(context.applicationContext)
                }
                AudioRecorderEngine.State.IDLE -> {
                    barsView.isRecording = false
                    barsView.clearRecordingAmplitudes()
                    // Engine just reset `durationMs` to 0 — refresh the label
                    // so the last frozen value from a prior stop doesn't
                    // linger after cancel.
                    updateTimeLabel()
                    compositeState = CompositeState.IDLE
                    WaveformRecorderBackgroundService.stop(context.applicationContext)
                }
                AudioRecorderEngine.State.ERROR -> {
                    compositeState = CompositeState.ERROR
                    WaveformRecorderBackgroundService.stop(context.applicationContext)
                }
            }
        }
        engine.onMeter = { amplitude, peak, db ->
            onMeter?.invoke(amplitude, peak, db)
            val now = SystemClock.elapsedRealtimeNanos()
            val intervalNs = (1_000_000_000L / max(1, samplesPerSecond)).coerceAtLeast(1L)
            if (lastVisualSampleNs == 0L || (now - lastVisualSampleNs) >= intervalNs) {
                lastVisualSampleNs = now
                barsView.appendAmplitude(amplitude)
            }
            updateTimeLabel()
        }
        engine.onMaxDurationReached = {
            onMaxDurationReached?.invoke()
        }
        engine.onSilenceDetected = { elapsedMs ->
            onSilenceDetected?.invoke(elapsedMs)
        }
        engine.onPcmChunk = { chunk, sr, ch, bps, ts ->
            onPcmChunk?.invoke(chunk, sr, ch, bps, ts)
        }
        engine.onPermissionDenied = {
            onPermissionDenied?.invoke()
        }
        engine.onError = { msg, code ->
            onError?.invoke(msg, code)
        }
        engine.onComplete = { uri, durationMs, sizeBytes, mimeType, peak, history ->
            val downsampled = downsampleTo64(history)
            onComplete?.invoke(
                uri,
                durationMs,
                if (outputFormat.isBlank()) "m4a" else outputFormat,
                mimeType,
                sizeBytes,
                engine.sampleRate,
                engine.channels,
                downsampled,
                peak
            )
            // Flip out of "live recording" mode so the scroll loop stops.
            // Keep the ring buffer so the bars stay frozen on screen until
            // the next start() / cancel() / tearDown() / enterPreview().
            barsView.isRecording = false
        }

        playerEngine.onLoad = { _ ->
            // No-op for the JS API — the state callback below already keeps
            // the play button visible / play icon up to date.
        }
        playerEngine.onLoadError = { msg ->
            onError?.invoke(msg, "preview-load")
        }
        playerEngine.onStateChange = {
            playButton.isPlaying = playerEngine.isPlaying
            playButton.isLoading = playerEngine.state == AudioPlayerEngine.State.LOADING
        }
        playerEngine.onTimeUpdate = { currentMs, durationMs ->
            if (!isScrubbing) {
                barsView.progressFraction = if (durationMs > 0) {
                    currentMs.toFloat() / durationMs.toFloat()
                } else 0f
                updateTimeLabel(currentMs = currentMs, durationMs = durationMs)
            }
            onPlaybackTimeUpdate?.invoke(currentMs, durationMs)
        }
        playerEngine.onEnded = {
            playButton.isPlaying = false
        }
    }

    private fun applyControlledState() {
        val desired = controlledState.lowercase()
        if (desired == "auto" || desired.isEmpty()) return
        when (desired) {
            "recording" -> when (compositeState) {
                CompositeState.PAUSED -> resumeCommand()
                CompositeState.IDLE, CompositeState.STOPPED -> startCommand()
                CompositeState.PREVIEW -> resumeCommand()
                else -> Unit
            }
            "paused" -> if (compositeState == CompositeState.RECORDING) pauseCommand()
            "preview" -> if (
                compositeState == CompositeState.PAUSED ||
                compositeState == CompositeState.RECORDING
            ) enterPreviewCommand()
            "stopped" -> if (
                compositeState == CompositeState.RECORDING ||
                compositeState == CompositeState.PAUSED ||
                compositeState == CompositeState.PREVIEW
            ) stopCommand()
            "idle" -> if (compositeState != CompositeState.IDLE) cancelCommand()
        }
    }

    private fun compositeStateString(): String = when (compositeState) {
        CompositeState.IDLE -> "idle"
        CompositeState.RECORDING -> "recording"
        CompositeState.PAUSED -> "paused"
        CompositeState.PREVIEW -> "preview"
        CompositeState.STOPPED -> "stopped"
        CompositeState.ERROR -> "error"
    }

    private fun emitStateChange() {
        val s = compositeStateString()
        if (s == lastEmittedState) return
        lastEmittedState = s
        onStateChange?.invoke(s, engine.durationMs)
    }

    private fun emitStateChangeForce(state: String, durationMs: Int) {
        lastEmittedState = state
        onStateChange?.invoke(state, durationMs)
    }

    private fun updatePlayButtonVisibility() {
        val shouldShow = compositeState == CompositeState.PREVIEW && showPlayButton
        // Keep INVISIBLE (not GONE) when hiding so the button + its
        // child views stay measured for the next VISIBLE transition.
        playButton.visibility = if (shouldShow) View.VISIBLE else View.INVISIBLE
        requestLayout()
        // Fabric host views can swallow `requestLayout()` because the
        // Yoga-driven parent's measured bounds haven't changed. Drive a
        // measure + layout pass manually with our current bounds so the
        // play button is repositioned (and the bars view shrinks /
        // expands accordingly) immediately on the next frame.
        if (width > 0 && height > 0) {
            measure(
                View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY)
            )
            layout(left, top, right, bottom)
        }
    }

    // endregion

    // region Play button & scrub ----------------------------------------------

    private fun handlePlayButtonClick() {
        if (compositeState != CompositeState.PREVIEW) return
        playerEngine.toggle()
    }

    private fun handleScrubBegan(fraction: Float) {
        if (compositeState != CompositeState.PREVIEW) return
        isScrubbing = true
        resumeAfterScrub = playerEngine.isPlaying
        if (playerEngine.isPlaying) playerEngine.pause()
        val pos = positionFromFraction(fraction)
        playerEngine.seekToMs(pos)
        barsView.progressFraction = fraction
        updateTimeLabel(currentMs = pos, durationMs = playerEngine.durationMs)
    }

    private fun handleScrubMoved(fraction: Float) {
        if (compositeState != CompositeState.PREVIEW) return
        val pos = positionFromFraction(fraction)
        playerEngine.seekToMs(pos)
        barsView.progressFraction = fraction
        updateTimeLabel(currentMs = pos, durationMs = playerEngine.durationMs)
    }

    private fun handleScrubEnded(fraction: Float, cancelled: Boolean) {
        if (compositeState != CompositeState.PREVIEW) return
        isScrubbing = false
        val pos = positionFromFraction(fraction)
        playerEngine.seekToMs(pos)
        barsView.progressFraction = fraction
        updateTimeLabel(currentMs = pos, durationMs = playerEngine.durationMs)
        onSeek?.invoke(pos)
        if (!cancelled && resumeAfterScrub) {
            playerEngine.play()
        }
    }

    private fun positionFromFraction(fraction: Float): Int {
        val dur = playerEngine.durationMs
        if (dur <= 0) return 0
        return (fraction.coerceIn(0f, 1f) * dur).toInt().coerceIn(0, dur)
    }

    // endregion

    // region Time label -------------------------------------------------------

    private fun updateTimeLabel(currentMs: Int? = null, durationMs: Int? = null) {
        val isPreview = compositeState == CompositeState.PREVIEW
        val cur = currentMs ?: if (isPreview) playerEngine.currentMs else engine.durationMs
        val dur = durationMs ?: if (isPreview) max(playerEngine.durationMs, engine.durationMs)
            else engine.maxDurationMs
        val display = if (timeMode == "count-down" && dur > 0) {
            (dur - cur).coerceAtLeast(0)
        } else cur
        val totalSeconds = display / 1000
        val minutes = totalSeconds / 60
        val seconds = totalSeconds % 60
        timeLabel.text = String.format("%d:%02d", minutes, seconds)
    }

    // endregion

    // region Helpers ----------------------------------------------------------

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()

    /**
     * Bucket the per-tick amplitudes into 64 RMS-style buckets normalised to
     * the loudest bucket — mirrors the WhatsApp voice-note encoding (a
     * 64-byte array, 0..100 wire values; we emit floats in [0, 1] for max
     * portability).
     */
    private fun downsampleTo64(samples: FloatArray): FloatArray {
        val buckets = 64
        val out = FloatArray(buckets)
        if (samples.isEmpty()) return out
        val sumSquares = DoubleArray(buckets)
        val counts = IntArray(buckets)
        for (i in samples.indices) {
            val bucket = ((i * buckets) / samples.size).coerceIn(0, buckets - 1)
            val v = samples[i].toDouble()
            sumSquares[bucket] += v * v
            counts[bucket]++
        }
        var maxV = 0f
        for (i in 0 until buckets) {
            val n = counts[i]
            if (n > 0) {
                val rms = sqrt(sumSquares[i] / n).toFloat()
                out[i] = rms
                if (rms > maxV) maxV = rms
            }
        }
        if (maxV > 0f) {
            for (i in 0 until buckets) {
                out[i] = (out[i] / maxV).coerceIn(0f, 1f)
            }
        }
        return out
    }

    // endregion
}
