---
description: "Events fired by WaveformRecorderView: state changes, meter levels, completion with the 64-bar export, error codes, preview, slide gestures, silence and PCM."
---

# Events {#events}

All events are props on `WaveformRecorderView`. Payload types are in the [API reference](/api/).

| Event | Payload | When |
| --- | --- | --- |
| `onStateChange` | `{ state, durationMs }` | On every state change. |
| `onMeter` | `{ amplitude, peak, db }` | `meterUpdatesPerSecond` times per second while recording. |
| `onComplete` | see [below](#oncomplete) | Once the final file is written after `stop()` or an automatic stop. |
| `onMaxDurationReached` | none | When `maxDurationMs` is reached, right before the automatic stop. |
| `onPermissionDenied` | none | When `start()` cannot get microphone permission. |
| `onError` | `{ message, code? }` | Warnings and failures, see [error codes](#error-codes). |
| `onSeek` | `{ positionMs }` | In preview, at the end of a scrub and after `seekPreview()`. |
| `onPlaybackTimeUpdate` | `{ positionMs, durationMs }` | About 30 times per second while preview audio plays. |
| `onSlideProgress` | `{ cancelProgress, lockProgress }` | While the user drags on the view during recording. |
| `onSlideCancel` | none | Once per drag, when the cancel threshold is crossed. |
| `onSlideLock` | none | Once per drag, when the lock threshold is crossed. |
| `onSilenceDetected` | `{ durationMs }` | Once per quiet stretch, see [Silence detection](/guide/silence-detection). |
| `onPcmChunk` | `{ chunk, sampleRate, channels, bytesPerSample, timestampMs }` | About every `pcmChunkMs` while PCM streaming is on, see [PCM stream](/guide/pcm-stream). |

## onStateChange {#onstatechange}

`state` is one of `'idle'`, `'recording'`, `'paused'`, `'preview'`, `'stopped'` or `'error'`. `durationMs` is the recorded time so far, without the time spent paused. See [Segments, pause and preview](/guide/segments#states) for the transitions.

## onMeter {#onmeter}

| Field | Meaning |
| --- | --- |
| `amplitude` | Current level in `[0, 1]`, the value used for the newest bar. |
| `peak` | Highest `amplitude` so far in this session. |
| `db` | Current level in dBFS. `0` is full scale, quieter is more negative. |

The two platforms measure the level differently, so the same sound gives different numbers. iOS reports the average power over the last tick and maps it as `10^(db / 20)`, with anything at or below -60 dB shown as `0`. Android reports the peak since the last tick and maps it as the square root of the linear peak. Do not compare raw values across platforms.

## onComplete {#oncomplete}

| Field | Type | Meaning |
| --- | --- | --- |
| `uri` | `string` | `file://` URI of the recording. |
| `durationMs` | `number` | Recorded duration, summed over all segments. |
| `format` | `string` | The `output.format` you asked for. |
| `mimeType` | `string` | MIME type, see [Formats](/guide/export#formats). |
| `sizeBytes` | `number` | File size. |
| `sampleRate` | `number` | Sample rate in Hz. |
| `channels` | `number` | Channel count. |
| `samples` | `number[]` | 64 values in `[0, 1]` for a chat bubble, see [Export](/guide/export#the-64-bar-export). |
| `peakAmplitude` | `number` | Highest meter `amplitude` of the session. |

`onComplete` does not fire when nothing was recorded, when `cancel()` is called, or when `minDurationMs` discards the recording.

## Error codes {#error-codes}

`onError` is used for real failures and for warnings about calls that were ignored. Check `code`:

| Code | Meaning |
| --- | --- |
| `start` | The recorder could not start. The state becomes `'error'`. |
| `session` | iOS could not configure the audio session. The state becomes `'error'`. |
| `resume` | Resuming after `pause()` failed. The state becomes `'error'`. |
| `media-recorder` | Android: `MediaRecorder` reported an error while recording. |
| `min-duration` | `stop()` was called below `minDurationMs`. The recording was discarded. |
| `preview-disabled` | `enterPreview()` was called with `enablePreview={false}`. |
| `continue-disabled` | `resume()` was called in preview with `enableContinueRecording={false}`. |
| `preview-snapshot` | Preview could not be prepared, for example because nothing was recorded yet. |
| `preview-load` | The preview player could not load the audio. |
| `concat` | Joining segments failed. `onComplete` still fires with the first segment so the audio is not lost. |
| `format-unsupported` | `opus` was requested on Android below API 29. The engine records AAC instead. |
| `pcm-stream` | iOS: PCM streaming could not open the WAV file. |
| `background-capability` | iOS: `backgroundRecording` is on but `audio` is missing from `UIBackgroundModes`. Fires once. |

From `'error'`, calling `start()` begins a new session.
