---
description: "Fixes for common react-native-waveform-recorder problems: no recording, lost files, flat bars, gestures not firing, silence never detected and Expo builds."
---

# Troubleshooting {#troubleshooting}

## Nothing happens when I call start() {#start-does-nothing}

- Check `onPermissionDenied` and `onError`. A refused permission fires `onPermissionDenied`, a recorder failure fires `onError` with code `'start'` or `'session'`.
- On iOS, if the user refused the microphone once, the prompt never comes back. Send them to Settings with `Linking.openSettings()`.
- Make sure `NSMicrophoneUsageDescription` is in `Info.plist`. Without it, iOS terminates the app when recording starts.
- Make sure the ref is set. On iOS, a recorder inside a parent with `display: 'none'` is unmounted and its ref is `null`.
- Check that you did not set the `state` prop. It switches the view into an experimental controlled mode in which the ref methods do not record, see [Controlled state](/guide/props#controlled-state).

## The view is empty or has no height {#no-height}

The view has no intrinsic size. Give it a height in `style`, for example `height: 56`.

## The file from onComplete is gone {#file-is-gone}

`cancel()` (also after `stop()`) and unmounting the view delete the session's segment files, and for a recording without a preview and continue step that is the delivered file. Copy or move the file in `onComplete`, see [Keep the file](/guide/export#keep-the-file). Also remember that cache directories can be cleared by the system.

## stop() discarded my recording {#stop-discarded}

`minDurationMs` is set and the recording was shorter. The state returns to `idle` and `onError` fires with code `'min-duration'`. Lower or remove `minDurationMs`, or show the user a hint when you get this code.

## output.uri is ignored {#output-uri-ignored}

- On iOS, pass a `file://` URI, not a plain path.
- After a preview and continue, the result is a new joined file in the cache directory, not `output.uri`. Use `onComplete.uri`.

## The bars barely move, or move too much {#bars}

The bars follow the platform's meter: average power on iOS, peaks on Android. Quiet speech on iOS can stay near the bottom, because anything at or below -60 dB is drawn as `0`. Change the visual density with `samplesPerSecond`, `barWidth` and `barGap`. `recordingMode` and `newSampleEntry` currently have no visible effect.

## Slide gestures do not fire {#gestures-do-not-fire}

- Set `enableSlideToCancel` and/or `enableSlideToLock`. Both are `false` by default.
- The drag must start **on the recorder view** while the state is `recording`. A finger that was already down when recording started, for example on a press-and-hold button, is not tracked. See [Hold to record](/guide/gestures#hold-to-record).
- `onSlideCancel` does not cancel by itself. Call `ref.current?.cancel()` in the handler.

## Silence is never detected {#silence-never-detected}

Set both `silenceThresholdDb` and `silenceTimeoutMs`. The defaults (`-160` and `0`) never fire. If it still does not fire, the room is louder than your threshold; log `onMeter` and raise the threshold, see [Choosing a threshold](/guide/silence-detection#choosing-a-threshold).

## No PCM chunks {#no-pcm-chunks}

`enablePcmStream` only works when `output.format` is `'wav'`, and it must be on before `start()`.

## Recording stops in the background {#background}

Set `backgroundRecording` and do the native setup in [Installation](/guide/installation#background-recording). On iOS, watch for `onError` with code `'background-capability'`. On Android, check logcat for a `startForegroundService failed` warning, which means the service is not declared.

## Opus file does not play {#opus}

iOS writes Opus in a `.caf` container, which many non-Apple players cannot open. On Android below API 29 the file is AAC despite its `.ogg` name. Use `m4a` if the file is shared across platforms.

## Expo: the module is not found {#expo}

The library does not run in Expo Go. Build a development client after adding the config plugin and run `npx expo prebuild --clean`. See [Expo](/guide/installation#expo).

## Rendering on web throws {#web}

The view is native only. Render a fallback on web, see [Platform notes](/guide/platform-notes#web).
