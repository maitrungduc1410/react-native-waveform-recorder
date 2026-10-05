---
description: "Platform differences in react-native-waveform-recorder: iOS audio session, Android recorders and foreground service, meter values, file formats, layout and web."
---

# Platform notes {#platform-notes}

The two native implementations follow the same design, but they sit on different audio APIs. This page lists the differences you may notice.

## iOS {#ios}

- **Recorder.** Every format is recorded with `AVAudioRecorder`. The meter is its average power for the last tick.
- **Audio session.** On `start()` the library sets the shared `AVAudioSession` to the `playAndRecord` category with the `defaultToSpeaker` and `allowBluetooth` options, and activates it. It deactivates the session after `stop()` and `cancel()`. If your app plays other audio at the same time, expect it to be affected and reconfigure the session afterwards if needed.
- **Interruptions.** The library does not observe audio session interruptions such as phone calls, or app state changes. Use `AppState` to pause or stop yourself if your app needs it.
- **Permission.** The system prompt appears on the first `start()`. After a refusal, iOS never prompts again and every `start()` fires `onPermissionDenied`.
- **`output.uri`.** Must be a `file://` URI. A plain path is not accepted.

## Android {#android}

- **Recorders.** `m4a`, `aac` and `opus` use `MediaRecorder`; the meter is its maximum amplitude since the last tick. `wav` uses `AudioRecord` with a 16-bit PCM writer; the meter is the peak of the latest buffer. Both use the `MIC` audio source.
- **Permission.** The JavaScript wrapper requests `RECORD_AUDIO` before every `start()`. The permission is declared in the library's manifest.
- **Bitrate.** `output.bitrate` is clamped to a range that depends on `output.quality`, see [Formats](/guide/export#formats).
- **Opus.** Needs API 29. Below that, the engine records AAC and fires `onError` with code `'format-unsupported'`.
- **Scrubbing.** In preview the view asks its parent not to intercept the touch, so scrubbing works inside a `ScrollView` or a pager.

## Background recording {#background-recording}

| | iOS | Android |
| --- | --- | --- |
| What keeps recording alive | The `audio` entry in `UIBackgroundModes` | A foreground service of type `microphone` |
| What the `backgroundRecording` prop does | Checks for the `audio` entry and fires `onError` with code `'background-capability'` once per launch if it is missing | Starts the service when recording starts and stops it on `stop()`, `cancel()` or an error |
| If the native setup is missing | Recording pauses when the app goes to the background | The service fails to start and the library only logs a warning to logcat |

On iOS, the background mode applies as soon as it is in `Info.plist`, whatever the prop says. On Android the service keeps running while paused and in preview. On Android 13 and later, the service notification is only shown in the notification drawer if your app holds the `POST_NOTIFICATIONS` permission; the service runs either way.

## Meter values {#meter-values}

iOS reports average power and Android reports peaks, so for the same sound Android shows higher `amplitude` and `db` values. This affects the bars, `onMeter`, the 64-bar export and [silence thresholds](/guide/silence-detection#choosing-a-threshold).

## Layout {#layout}

| | iOS | Android |
| --- | --- | --- |
| Inner padding | 12 pt | 12 dp |
| Preview play button | 60% of the view height, at most 36 pt | 32 dp |
| Time label | 48 pt wide, 13 pt semibold | 48 dp wide, 13 sp |
| Default `futureBarColor` | `unplayedBarColor` at 60% opacity | `unplayedBarColor` with its opacity multiplied by 0.6 |

## Fabric lifecycle {#fabric-lifecycle}

- On iOS, `display: 'none'` unmounts the native view. The ref becomes `null`, calls are lost and the session's files are cleaned up. Move the view off screen instead if it must stay mounted.
- When the view is removed (iOS recycling, Android `onDropViewInstance`), the recorder is cancelled and its segment files are deleted, see [Keep the file](/guide/export#keep-the-file).

## Web {#web}

The package has a web entry point so that shared code still bundles, but rendering `WaveformRecorderView` on web throws an error and `ensureMicrophonePermission()` resolves `false`. Render something else on web, for example behind `Platform.OS !== 'web'`.
