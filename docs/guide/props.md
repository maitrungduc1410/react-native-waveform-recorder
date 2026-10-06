---
description: "Every prop of WaveformRecorderView with its type and native default: output format, limits, bar and pill styling, preview, gestures, PCM and silence."
---

# Props {#props}

`WaveformRecorderView` accepts the props below plus standard `View` props such as `style` and `testID`. Give it a height: the view has no intrinsic size. Event props are listed in [Events](/guide/events). Types are in the [API reference](/api/type-aliases/WaveformRecorderViewProps).

## Output {#output}

All output settings live in one nested `output` prop. Every field is optional.

```tsx
<WaveformRecorderView
  output={{ format: 'm4a', sampleRate: 44100, channels: 1, bitrate: 128000, quality: 'high' }}
/>
```

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `uri` | `string` | A file in the cache directory | `file://` URI for the recording. Only used for recordings with a single segment; see [Segments](/guide/segments#where-files-go). |
| `format` | `'m4a' \| 'aac' \| 'wav' \| 'opus'` | `'m4a'` | See [Formats](/guide/export#formats). |
| `sampleRate` | `number` | `44100` | In Hz. |
| `channels` | `1 \| 2` | `1` | |
| `bitrate` | `number` | `128000` | Bits per second. Ignored for `wav`. Clamped by `quality` on Android. |
| `quality` | `'low' \| 'medium' \| 'high'` | `'high'` | Encoder quality on iOS, bitrate range on Android. |

## Recording limits and timing {#recording-limits}

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `maxDurationMs` | `number` | `0` | Stops automatically when reached: `onMaxDurationReached` fires, then `onComplete`. `0` means no limit. |
| `minDurationMs` | `number` | `0` | If `stop()` is called with less audio than this, the recording is **discarded**: the state returns to `idle` and `onError` fires with code `'min-duration'`. |
| `meterUpdatesPerSecond` | `number` | `30` | How often the level is read and `onMeter` fires. Clamped to 1 to 120. |
| `samplesPerSecond` | `number` | `12` | How many bars per second are added. A bar is added on a meter tick, so it cannot go above `meterUpdatesPerSecond`. |

## Bars {#bars}

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `playedBarColor` | `ColorValue` | white | Bars while recording, and the played part during preview. |
| `unplayedBarColor` | `ColorValue` | white at 50% opacity | The unplayed part during preview. |
| `futureBarColor` | `ColorValue` | `unplayedBarColor`, more transparent | Color of the `futureBarStyle` placeholders. |
| `barWidth` | `number` | `3` | In dp or points. |
| `barGap` | `number` | `2` | In dp or points. |
| `barRadius` | `number` | `-1` | Corner radius. Negative means `barWidth / 2`. |
| `futureBarStyle` | `'hidden' \| 'dot' \| 'line'` | `'hidden'` | What fills the empty slots on the left before the bars reach them. |
| `recordingMode` | `'scroll' \| 'morph' \| 'centered'` | `'scroll'` | Only `'scroll'` is implemented. The other values render like `'scroll'`. |
| `newSampleEntry` | `'grow' \| 'fade' \| 'none'` | `'grow'` | Currently every value uses the grow-in animation. |

## Pill and timer {#pill-and-timer}

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `containerBackgroundColor` | `ColorValue` | `#3478F6` | Background of the pill. |
| `containerBorderRadius` | `number` | `16` | |
| `showBackground` | `boolean` | `true` | Set to `false` to draw only bars and timer on your own background. |
| `showTime` | `boolean` | `true` | The `m:ss` label on the right. |
| `timeColor` | `ColorValue` | white | |
| `timeMode` | `'count-up' \| 'count-down'` | `'count-up'` | `'count-down'` shows the time left until `maxDurationMs` while recording, and the time left in the file during preview. Without `maxDurationMs` it counts up while recording. |

The default colors are white bars on a blue pill. If you set `showBackground={false}` on a light screen, also change `playedBarColor`, `unplayedBarColor` and `timeColor`.

## Preview {#preview}

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `enablePreview` | `boolean` | `true` | When `false`, `enterPreview()` fires `onError` with code `'preview-disabled'`. |
| `enableContinueRecording` | `boolean` | `true` | When `false`, `resume()` from preview fires `onError` with code `'continue-disabled'`. |
| `showPlayButton` | `boolean` | `true` | Play and pause button inside the pill during preview. |
| `playButtonColor` | `ColorValue` | white | |

## Gestures {#gestures}

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `enableSlideToCancel` | `boolean` | `false` | Fires `onSlideCancel` after a drag to the left. Call `cancel()` yourself. |
| `slideToCancelThresholdDp` | `number` | `80` | Horizontal distance in dp or points. |
| `enableSlideToLock` | `boolean` | `false` | Fires `onSlideLock` after an upward drag. |
| `slideToLockThresholdDp` | `number` | `80` | Vertical distance in dp or points. |

See [Slide gestures](/guide/gestures).

## PCM stream {#pcm-stream}

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `enablePcmStream` | `boolean` | `false` | Fires `onPcmChunk` while recording. Only with `output.format = 'wav'`. |
| `pcmChunkMs` | `number` | `200` | Approximate chunk length in ms, at least 20. |

See [PCM stream](/guide/pcm-stream).

## Background recording {#background-recording}

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `backgroundRecording` | `boolean` | `false` | Needs native setup, see [Installation](/guide/installation#background-recording). |
| `backgroundNotificationTitle` | `string` | `'Recording'` | Android only. |
| `backgroundNotificationBody` | `string` | `'Microphone recording in progress.'` | Android only. |

## Silence detection {#silence-detection}

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `silenceThresholdDb` | `number` | `-160` | Level in dBFS below which the input counts as silent. The default never triggers. |
| `silenceTimeoutMs` | `number` | `0` | How long the level must stay below the threshold. `0` disables detection. |
| `autoStopOnSilence` | `boolean` | `false` | Stop and finalise when silence is detected. |

Set both `silenceThresholdDb` and `silenceTimeoutMs` to turn detection on. See [Silence detection](/guide/silence-detection).

## Controlled state {#controlled-state}

`state` is an experimental controlled mode. When it is set, the ref methods stop running transitions and only report the requested state through `onStateChange`, and changing the prop does not start or stop recording either. Leave it unset and use the [ref methods](/guide/ref-methods).
