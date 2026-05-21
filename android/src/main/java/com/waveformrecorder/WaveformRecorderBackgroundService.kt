package com.waveformrecorder

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/**
 * Foreground service that keeps the recorder alive while the host app is in
 * the background. Bound to via [WaveformRecorderView.setBackgroundRecording].
 *
 * To opt in, the host app must:
 *
 *   1. Add `android.permission.FOREGROUND_SERVICE` and (on API 28+)
 *      `android.permission.FOREGROUND_SERVICE_MICROPHONE` to their manifest.
 *   2. Declare this service:
 *
 *      ```xml
 *      <service
 *          android:name="com.waveformrecorder.WaveformRecorderBackgroundService"
 *          android:foregroundServiceType="microphone"
 *          android:exported="false" />
 *      ```
 *
 * The service stays alive only while `WaveformRecorderView` has explicitly
 * started it via [start]. It shuts itself down on [stop]; if the app process
 * itself is killed the service tears down with it.
 */
class WaveformRecorderBackgroundService : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val title = intent?.getStringExtra(EXTRA_TITLE) ?: "Recording"
        val body = intent?.getStringExtra(EXTRA_BODY)
            ?: "Microphone recording in progress."

        createChannelIfNeeded()

        val notification = buildNotification(title, body)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
        return START_NOT_STICKY
    }

    private fun createChannelIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Audio recording",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Active microphone recording session."
            setShowBadge(false)
        }
        nm.createNotificationChannel(channel)
    }

    private fun buildNotification(title: String, body: String): Notification {
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        return builder
            .setContentTitle(title)
            .setContentText(body)
            .setOngoing(true)
            // We don't ship a custom icon — fall back to the framework mic
            // glyph so the notification is always renderable even before the
            // host app drops their own R.drawable resource in.
            .setSmallIcon(android.R.drawable.ic_btn_speak_now)
            .build()
    }

    companion object {
        private const val CHANNEL_ID = "waveform_recorder_channel"
        private const val NOTIFICATION_ID = 4711

        private const val EXTRA_TITLE = "title"
        private const val EXTRA_BODY = "body"

        /** Start the service. Safe to call repeatedly. */
        fun start(context: Context, title: String, body: String) {
            val intent = Intent(context, WaveformRecorderBackgroundService::class.java)
                .putExtra(EXTRA_TITLE, title)
                .putExtra(EXTRA_BODY, body)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                try {
                    context.startForegroundService(intent)
                } catch (e: Exception) {
                    // Host app didn't declare the service — swallow the
                    // crash but surface it via Logcat. The recorder itself
                    // keeps running; it just won't survive backgrounding.
                    android.util.Log.w(
                        "WaveformRecorder",
                        "startForegroundService failed; did you declare WaveformRecorderBackgroundService in AndroidManifest.xml?",
                        e
                    )
                }
            } else {
                try {
                    context.startService(intent)
                } catch (e: Exception) {
                    android.util.Log.w("WaveformRecorder", "startService failed", e)
                }
            }
        }

        /** Stop the service. Safe to call when not running. */
        fun stop(context: Context) {
            try {
                context.stopService(
                    Intent(context, WaveformRecorderBackgroundService::class.java)
                )
            } catch (_: Exception) {
            }
        }
    }
}
