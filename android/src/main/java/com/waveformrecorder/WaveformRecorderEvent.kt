package com.waveformrecorder

import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.events.Event

/**
 * Generic event wrapper for [WaveformRecorderView]. We dispatch one of these
 * with a specific `eventName` (`"topStateChange"`, `"topMeter"`, `"topComplete"`,
 * `"topMaxDurationReached"`, `"topPermissionDenied"`, `"topError"`) and a
 * per-event [WritableMap] payload.
 *
 * The `top` prefix is the legacy event-bubbling convention; codegen routes
 * it to the corresponding `on<Name>` prop on the JS side under both
 * architectures.
 */
class WaveformRecorderEvent(
    surfaceId: Int,
    viewTag: Int,
    private val name: String,
    private val payload: WritableMap
) : Event<WaveformRecorderEvent>(surfaceId, viewTag) {
    override fun getEventName(): String = name
    override fun getEventData(): WritableMap = payload
}
