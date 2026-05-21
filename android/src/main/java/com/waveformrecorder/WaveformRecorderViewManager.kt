package com.waveformrecorder

import android.graphics.Color
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.WritableMap
import com.facebook.react.module.annotations.ReactModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.facebook.react.uimanager.ViewManagerDelegate
import com.facebook.react.uimanager.events.EventDispatcher
import com.facebook.react.viewmanagers.WaveformRecorderViewManagerDelegate
import com.facebook.react.viewmanagers.WaveformRecorderViewManagerInterface

@ReactModule(name = WaveformRecorderViewManager.NAME)
class WaveformRecorderViewManager(
    @Suppress("UNUSED_PARAMETER") context: ReactApplicationContext
) : SimpleViewManager<WaveformRecorderView>(),
    WaveformRecorderViewManagerInterface<WaveformRecorderView> {

    private val mDelegate: ViewManagerDelegate<WaveformRecorderView> =
        WaveformRecorderViewManagerDelegate(this)

    override fun getDelegate(): ViewManagerDelegate<WaveformRecorderView> = mDelegate

    override fun getName(): String = NAME

    public override fun createViewInstance(context: ThemedReactContext): WaveformRecorderView {
        val view = WaveformRecorderView(context)
        wireEvents(view)
        return view
    }

    // ---------- Event wiring ---------------------------------------------------

    private fun wireEvents(view: WaveformRecorderView) {
        view.onStateChange = { state, durationMs ->
            dispatchEvent(view, "topStateChange") {
                putString("state", state)
                putInt("durationMs", durationMs)
            }
        }
        view.onMeter = { amplitude, peak, db ->
            dispatchEvent(view, "topMeter") {
                putDouble("amplitude", amplitude.toDouble())
                putDouble("peak", peak.toDouble())
                putDouble("db", db.toDouble())
            }
        }
        view.onComplete = { uri, durationMs, format, mimeType, sizeBytes, sampleRate, channels, samples, peak ->
            dispatchEvent(view, "topComplete") {
                putString("uri", uri)
                putInt("durationMs", durationMs)
                putString("format", format)
                putString("mimeType", mimeType)
                putInt("sizeBytes", sizeBytes)
                putInt("sampleRate", sampleRate)
                putInt("channels", channels)
                // Pack `samples` as a comma-separated string. Codegen
                // DirectEvent payloads don't support array fields, and a
                // CSV is cheaper to parse on the JS side than a JSON array.
                // 4 decimal places ≈ 0.5% precision — plenty for the visual
                // 64-bucket WhatsApp-style waveform.
                val sb = StringBuilder(samples.size * 7)
                for ((idx, value) in samples.withIndex()) {
                    if (idx > 0) sb.append(',')
                    sb.append(String.format("%.4f", value))
                }
                putString("samplesCsv", sb.toString())
                putDouble("peakAmplitude", peak.toDouble())
            }
        }
        view.onMaxDurationReached = {
            dispatchEvent(view, "topMaxDurationReached") {}
        }
        view.onPermissionDenied = {
            dispatchEvent(view, "topPermissionDenied") {}
        }
        view.onError = { message, code ->
            dispatchEvent(view, "topError") {
                putString("message", message)
                putString("code", code ?: "")
            }
        }
        view.onSeek = { positionMs ->
            dispatchEvent(view, "topSeek") {
                putInt("positionMs", positionMs)
            }
        }
        view.onPlaybackTimeUpdate = { positionMs, durationMs ->
            dispatchEvent(view, "topPlaybackTimeUpdate") {
                putInt("positionMs", positionMs)
                putInt("durationMs", durationMs)
            }
        }
        view.onSlideProgress = { cancelProgress, lockProgress ->
            dispatchEvent(view, "topSlideProgress") {
                putDouble("cancelProgress", cancelProgress.toDouble())
                putDouble("lockProgress", lockProgress.toDouble())
            }
        }
        view.onSlideCancel = {
            dispatchEvent(view, "topSlideCancel") {}
        }
        view.onSlideLock = {
            dispatchEvent(view, "topSlideLock") {}
        }
        view.onSilenceDetected = { elapsedMs ->
            dispatchEvent(view, "topSilenceDetected") {
                putInt("durationMs", elapsedMs)
            }
        }
        view.onPcmChunk = { chunk, sr, ch, bps, ts ->
            dispatchEvent(view, "topPcmChunk") {
                putString("chunk", chunk)
                putInt("sampleRate", sr)
                putInt("channels", ch)
                putInt("bytesPerSample", bps)
                putInt("timestampMs", ts)
            }
        }
    }

    private inline fun dispatchEvent(
        view: WaveformRecorderView,
        eventName: String,
        builder: WritableMap.() -> Unit
    ) {
        val context = view.context as? ThemedReactContext ?: return
        val dispatcher: EventDispatcher? =
            UIManagerHelper.getEventDispatcherForReactTag(context, view.id)
        val surfaceId = UIManagerHelper.getSurfaceId(context)
        val payload = Arguments.createMap()
        payload.builder()
        dispatcher?.dispatchEvent(
            WaveformRecorderEvent(surfaceId, view.id, eventName, payload)
        )
    }

    // ---------- Fabric prop setters --------------------------------------------

    override fun setOutputUri(view: WaveformRecorderView, value: String?) {
        view.outputUri = value ?: ""
    }
    override fun setOutputFormat(view: WaveformRecorderView, value: String?) {
        view.outputFormat = value ?: "m4a"
    }
    override fun setOutputSampleRate(view: WaveformRecorderView, value: Int) {
        view.outputSampleRate = if (value > 0) value else 44100
    }
    override fun setOutputChannels(view: WaveformRecorderView, value: Int) {
        view.outputChannels = value.coerceIn(1, 2)
    }
    override fun setOutputBitrate(view: WaveformRecorderView, value: Int) {
        view.outputBitrate = if (value > 0) value else 128_000
    }
    override fun setOutputQuality(view: WaveformRecorderView, value: String?) {
        view.outputQuality = value ?: "high"
    }
    override fun setMaxDurationMs(view: WaveformRecorderView, value: Int) {
        view.maxDurationMs = value.coerceAtLeast(0)
    }
    override fun setMinDurationMs(view: WaveformRecorderView, value: Int) {
        view.minDurationMs = value.coerceAtLeast(0)
    }

    override fun setPlayedBarColor(view: WaveformRecorderView, value: Int?) {
        view.setPlayedBarColor(value ?: Color.WHITE)
    }
    override fun setUnplayedBarColor(view: WaveformRecorderView, value: Int?) {
        view.setUnplayedBarColor(value ?: Color.argb(128, 255, 255, 255))
    }
    override fun setFutureBarColor(view: WaveformRecorderView, value: Int?) {
        // `null` -> auto-derive from `unplayedBarColor`.
        view.setFutureBarColor(value)
    }
    override fun setBarWidth(view: WaveformRecorderView, value: Float) {
        view.setBarWidthDp(if (value > 0f) value else 3f)
    }
    override fun setBarGap(view: WaveformRecorderView, value: Float) {
        view.setBarGapDp(if (value >= 0f) value else 2f)
    }
    override fun setBarRadius(view: WaveformRecorderView, value: Float) {
        view.setBarRadiusDp(value)
    }

    override fun setContainerBackgroundColor(view: WaveformRecorderView, value: Int?) {
        view.containerBackgroundColor = value ?: Color.parseColor("#3478F6")
    }
    override fun setContainerBorderRadius(view: WaveformRecorderView, value: Float) {
        view.containerBorderRadiusDp = if (value >= 0f) value else 16f
    }
    override fun setShowBackground(view: WaveformRecorderView, value: Boolean) {
        view.showBackground = value
    }

    override fun setShowTime(view: WaveformRecorderView, value: Boolean) {
        view.showTime = value
    }
    override fun setTimeColor(view: WaveformRecorderView, value: Int?) {
        view.timeColor = value ?: Color.WHITE
    }
    override fun setTimeMode(view: WaveformRecorderView, value: String?) {
        view.timeMode = value ?: "count-up"
    }

    override fun setRecordingMode(view: WaveformRecorderView, value: String?) {
        view.setRecordingMode(value ?: "scroll")
    }
    override fun setFutureBarStyle(view: WaveformRecorderView, value: String?) {
        view.setFutureBarStyle(value ?: "dot")
    }
    override fun setNewSampleEntry(view: WaveformRecorderView, value: String?) {
        view.setNewSampleEntry(value ?: "grow")
    }
    override fun setMeterUpdatesPerSecond(view: WaveformRecorderView, value: Int) {
        view.meterUpdatesPerSecond = value.coerceIn(1, 120)
    }
    override fun setSamplesPerSecond(view: WaveformRecorderView, value: Int) {
        view.samplesPerSecond = value.coerceAtLeast(1)
    }
    override fun setControlledState(view: WaveformRecorderView, value: String?) {
        view.controlledState = value ?: "auto"
    }

    // ---------- v0.2 preview props --------------------------------------------

    override fun setEnablePreview(view: WaveformRecorderView, value: Boolean) {
        view.enablePreview = value
    }
    override fun setEnableContinueRecording(view: WaveformRecorderView, value: Boolean) {
        view.enableContinueRecording = value
    }
    override fun setShowPlayButton(view: WaveformRecorderView, value: Boolean) {
        view.showPlayButton = value
    }
    override fun setPlayButtonColor(view: WaveformRecorderView, value: Int?) {
        view.playButtonColor = value ?: Color.WHITE
    }

    // ---------- v0.3 gesture / silence props ----------------------------------

    override fun setEnableSlideToCancel(view: WaveformRecorderView, value: Boolean) {
        view.enableSlideToCancel = value
    }
    override fun setSlideToCancelThresholdDp(view: WaveformRecorderView, value: Float) {
        view.slideToCancelThresholdDp = if (value > 0f) value else 80f
    }
    override fun setEnableSlideToLock(view: WaveformRecorderView, value: Boolean) {
        view.enableSlideToLock = value
    }
    override fun setSlideToLockThresholdDp(view: WaveformRecorderView, value: Float) {
        view.slideToLockThresholdDp = if (value > 0f) value else 80f
    }
    override fun setSilenceThresholdDb(view: WaveformRecorderView, value: Float) {
        view.silenceThresholdDb = value
    }
    override fun setSilenceTimeoutMs(view: WaveformRecorderView, value: Int) {
        view.silenceTimeoutMs = value.coerceAtLeast(0)
    }
    override fun setAutoStopOnSilence(view: WaveformRecorderView, value: Boolean) {
        view.autoStopOnSilence = value
    }

    // ---------- v1.0 raw-PCM streaming ----------------------------------------

    override fun setEnablePcmStream(view: WaveformRecorderView, value: Boolean) {
        view.enablePcmStream = value
    }
    override fun setPcmChunkMs(view: WaveformRecorderView, value: Int) {
        view.pcmChunkMs = value
    }

    // ---------- v1.0 background recording -------------------------------------

    override fun setBackgroundRecording(view: WaveformRecorderView, value: Boolean) {
        view.backgroundRecording = value
    }
    override fun setBackgroundNotificationTitle(view: WaveformRecorderView, value: String?) {
        view.backgroundNotificationTitle = value ?: "Recording"
    }
    override fun setBackgroundNotificationBody(view: WaveformRecorderView, value: String?) {
        view.backgroundNotificationBody = value ?: "Microphone recording in progress."
    }

    // ---------- Commands -------------------------------------------------------

    override fun start(view: WaveformRecorderView) {
        view.startCommand()
    }
    override fun pause(view: WaveformRecorderView) {
        view.pauseCommand()
    }
    override fun resume(view: WaveformRecorderView) {
        view.resumeCommand()
    }
    override fun stop(view: WaveformRecorderView) {
        view.stopCommand()
    }
    override fun cancel(view: WaveformRecorderView) {
        view.cancelCommand()
    }
    override fun enterPreview(view: WaveformRecorderView) {
        view.enterPreviewCommand()
    }
    override fun exitPreview(view: WaveformRecorderView) {
        view.exitPreviewCommand()
    }
    override fun togglePreviewPlayback(view: WaveformRecorderView) {
        view.togglePreviewPlaybackCommand()
    }
    override fun seekPreview(view: WaveformRecorderView, positionMs: Int) {
        view.seekPreviewCommand(positionMs)
    }

    // ---------- Lifecycle ------------------------------------------------------

    override fun onDropViewInstance(view: WaveformRecorderView) {
        // Stop active recording before Fabric pools the view — without an
        // explicit teardown the underlying MediaRecorder happily keeps
        // writing samples inside the pool after the JS component unmounts.
        view.tearDown()
        super.onDropViewInstance(view)
    }

    companion object {
        const val NAME = "WaveformRecorderView"
    }
}
