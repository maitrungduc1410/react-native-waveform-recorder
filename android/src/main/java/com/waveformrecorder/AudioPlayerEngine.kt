package com.waveformrecorder

import android.Manifest
import android.content.pm.PackageManager
import android.media.MediaPlayer
import android.media.PlaybackParams
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.util.Log

/**
 * Thin wrapper around the built-in `android.media.MediaPlayer` that exposes
 * the events the rest of the component needs: load lifecycle, periodic time
 * updates, end-of-track, and rate / seek control. All callbacks fire on the
 * main thread.
 *
 * Forked verbatim from the sibling
 * `react-native-waveform-player` library so the recorder can ship a
 * preview state without taking a runtime dependency on the player package.
 */
class AudioPlayerEngine {

    enum class State { IDLE, LOADING, READY, ENDED, ERROR }

    var state: State = State.IDLE
        private set

    var durationMs: Int = 0
        private set

    var currentMs: Int = 0
        private set

    var isPlaying: Boolean = false
        private set

    var rate: Float = 1.0f
        private set

    var loop: Boolean = false

    // Callbacks
    var onLoad: ((Int) -> Unit)? = null
    var onLoadError: ((String) -> Unit)? = null
    var onStateChange: (() -> Unit)? = null
    var onTimeUpdate: ((Int, Int) -> Unit)? = null
    var onEnded: (() -> Unit)? = null

    private var player: MediaPlayer? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    private val progressRunnable = object : Runnable {
        override fun run() {
            val p = player ?: return
            if (state != State.READY || !isPlaying) return
            try {
                currentMs = p.currentPosition.coerceIn(0, durationMs)
                onTimeUpdate?.invoke(currentMs, durationMs)
            } catch (_: IllegalStateException) {
                // Player isn't ready / has been released; just stop polling.
            }
            mainHandler.postDelayed(this, 33L)
        }
    }

    /** Cached rate to be applied once the player transitions to Started. */
    private var pendingRate: Float? = null

    /**
     * "Play once ready" intent recorded if `play()` is called while the
     * player is still in `LOADING`. Cleared on pause / reset / source
     * change. Resumed automatically when we transition into `READY`.
     */
    private var pendingStart: Boolean = false

    /**
     * Cached "would like a partial wake lock" flag. Applied each time the
     * underlying `MediaPlayer` is (re-)created. Requires the host app to
     * declare `WAKE_LOCK` in its manifest — without it `setWakeMode` throws
     * `SecurityException`, which we catch and ignore so playback still works
     * (it just won't survive device sleep with the screen off).
     */
    private var wakeModeEnabled: Boolean = false

    fun setSource(context: android.content.Context, uri: String) {
        reset()
        setStateInternal(State.LOADING)
        try {
            val mp = MediaPlayer()
            applyWakeMode(context, mp)
            mp.setOnPreparedListener { prepared ->
                durationMs = try { prepared.duration.coerceAtLeast(0) } catch (_: Exception) { 0 }
                setStateInternal(State.READY)
                onLoad?.invoke(durationMs)
            }
            mp.setOnCompletionListener {
                if (loop) {
                    try {
                        it.seekTo(0)
                        currentMs = 0
                        if (isPlaying) {
                            it.start()
                            applyPendingRate()
                        }
                    } catch (_: Exception) {}
                } else {
                    isPlaying = false
                    currentMs = durationMs
                    setStateInternal(State.ENDED)
                    onTimeUpdate?.invoke(currentMs, durationMs)
                    onEnded?.invoke()
                    stopProgressLoop()
                }
            }
            mp.setOnErrorListener { _, what, extra ->
                isPlaying = false
                stopProgressLoop()
                setStateInternal(State.ERROR)
                onLoadError?.invoke("MediaPlayer error: what=$what extra=$extra")
                true
            }
            try {
                if (uri.startsWith("http://") || uri.startsWith("https://")) {
                    mp.setDataSource(uri)
                } else {
                    mp.setDataSource(context, Uri.parse(uri))
                }
            } catch (e: Exception) {
                Log.e(TAG, "setDataSource failed", e)
                setStateInternal(State.ERROR)
                onLoadError?.invoke("setDataSource failed: ${e.message}")
                mp.release()
                return
            }
            try {
                mp.prepareAsync()
            } catch (e: Exception) {
                Log.e(TAG, "prepareAsync failed", e)
                setStateInternal(State.ERROR)
                onLoadError?.invoke("prepareAsync failed: ${e.message}")
                mp.release()
                return
            }
            player = mp
        } catch (e: Exception) {
            Log.e(TAG, "Failed to create MediaPlayer", e)
            setStateInternal(State.ERROR)
            onLoadError?.invoke(e.message ?: "Unknown error")
        }
    }

    fun play() {
        if (state == State.LOADING) {
            pendingStart = true
            return
        }
        val p = player ?: return
        if (state != State.READY && state != State.ENDED) return
        if (isPlaying && state == State.READY) return
        try {
            pendingStart = false
            if (state == State.ENDED) {
                p.seekTo(0)
                currentMs = 0
                setStateInternal(State.READY)
            }
            p.start()
            isPlaying = true
            applyPendingRate()
            startProgressLoop()
            onStateChange?.invoke()
        } catch (e: Exception) {
            isPlaying = false
            stopProgressLoop()
            Log.e(TAG, "play failed", e)
            onStateChange?.invoke()
        }
    }

    fun pause() {
        pendingStart = false
        val p = player ?: return
        if (!isPlaying) return
        try {
            p.pause()
            isPlaying = false
            stopProgressLoop()
            onStateChange?.invoke()
        } catch (e: Exception) {
            Log.e(TAG, "pause failed", e)
        }
    }

    fun toggle() {
        if (isPlaying) pause() else play()
    }

    fun seekToMs(ms: Int) {
        val p = player ?: return
        val clamped = ms.coerceIn(0, durationMs.coerceAtLeast(0))
        currentMs = clamped
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                p.seekTo(clamped.toLong(), MediaPlayer.SEEK_CLOSEST)
            } else {
                p.seekTo(clamped)
            }
        } catch (e: Exception) {
            Log.e(TAG, "seekTo failed", e)
        }
    }

    fun setRate(newRate: Float) {
        val clamped = newRate.coerceIn(0.25f, 4.0f)
        rate = clamped
        val p = player ?: return
        if (isPlaying) {
            try {
                p.playbackParams = PlaybackParams().setSpeed(clamped)
                pendingRate = null
            } catch (e: Exception) {
                Log.e(TAG, "setPlaybackParams failed", e)
                pendingRate = clamped
            }
        } else {
            pendingRate = clamped
        }
    }

    /**
     * Toggle whether `MediaPlayer.setWakeMode(PARTIAL_WAKE_LOCK)` should be
     * applied. Takes effect on the next `setSource(...)` call (and the
     * current player, if any).
     */
    fun setBackgroundPlaybackEnabled(context: android.content.Context, enabled: Boolean) {
        wakeModeEnabled = enabled
        player?.let { applyWakeMode(context, it) }
    }

    private fun applyWakeMode(context: android.content.Context, mp: MediaPlayer) {
        if (!wakeModeEnabled) return
        val granted = context.checkSelfPermission(Manifest.permission.WAKE_LOCK) ==
            PackageManager.PERMISSION_GRANTED
        if (!granted) {
            Log.w(
                TAG,
                "playInBackground=true but WAKE_LOCK permission is not granted — skipping " +
                    "MediaPlayer.setWakeMode. Background playback still works while the screen " +
                    "is on. To survive device sleep, add " +
                    "`<uses-permission android:name=\"android.permission.WAKE_LOCK\"/>` " +
                    "to your app manifest."
            )
            return
        }
        try {
            mp.setWakeMode(context.applicationContext, PowerManager.PARTIAL_WAKE_LOCK)
        } catch (e: Exception) {
            Log.w(TAG, "setWakeMode failed", e)
        }
    }

    private fun applyPendingRate() {
        val p = player ?: return
        val target = pendingRate ?: rate
        try {
            p.playbackParams = PlaybackParams().setSpeed(target)
            pendingRate = null
        } catch (e: Exception) {
            Log.e(TAG, "applyPendingRate failed", e)
        }
    }

    fun reset() {
        stopProgressLoop()
        try { player?.reset() } catch (_: Exception) {}
        try { player?.release() } catch (_: Exception) {}
        player = null
        isPlaying = false
        currentMs = 0
        durationMs = 0
        rate = 1.0f
        pendingRate = null
        pendingStart = false
        setStateInternal(State.IDLE)
    }

    private fun setStateInternal(newState: State) {
        if (state == newState) return
        state = newState
        if (newState == State.READY && pendingStart) {
            pendingStart = false
            tryStartPlaybackInternal()
        }
        onStateChange?.invoke()
    }

    private fun tryStartPlaybackInternal() {
        val p = player ?: return
        try {
            p.start()
            isPlaying = true
            applyPendingRate()
            startProgressLoop()
        } catch (e: Exception) {
            isPlaying = false
            stopProgressLoop()
            Log.e(TAG, "deferred play failed", e)
        }
    }

    private fun startProgressLoop() {
        stopProgressLoop()
        mainHandler.post(progressRunnable)
    }

    private fun stopProgressLoop() {
        mainHandler.removeCallbacks(progressRunnable)
    }

    companion object {
        private const val TAG = "AudioPlayerEngine"
    }
}
