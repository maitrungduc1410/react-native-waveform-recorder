---
description: "Try a browser approximation of the waveform recorder: live bars from your microphone, pause, preview with scrubbing, slide gestures and the events they fire."
---

# Browser demo {#browser-demo}

The library only runs on iOS and Android, so this page uses a web approximation instead. It redraws the native view on a canvas with the same layout, bar animation and defaults, and runs the same state rules for the ref methods. Use it to get a feel for the props and to see which events fire and when.

<ClientOnly>
  <RecorderDemo />
</ClientOnly>

## What to try {#what-to-try}

- Press `start()` and speak. The bars enter from the right at `samplesPerSecond`, and `onMeter` updates `meterUpdatesPerSecond` times per second.
- While recording, drag on the pill. Dragging left reports `cancelProgress` and, past `slideToCancelThresholdDp`, fires `onSlideCancel`; the demo then calls `cancel()`, just as your app would. Dragging up fires `onSlideLock`; the "Locked" label is host UI, the library draws nothing for it.
- Press `enterPreview()`, then play and drag on the bars to seek. `resume()` from preview starts a new segment.
- Turn on silence detection, stay quiet and watch `onSilenceDetected`.
- Set `maxDurationMs` to `10000` to see `onMaxDurationReached` followed by `onComplete`.
- Switch `enablePreview` or `enableContinueRecording` off to see the matching `onError` codes.

## How it differs from the native view {#how-it-differs}

| | Native view | This demo |
| --- | --- | --- |
| Audio input | `AVAudioRecorder`, `MediaRecorder` or `AudioRecord` | `getUserMedia` and Web Audio, or a simulated voice |
| Output file | `m4a` by default, see [`output`](/guide/props#output) | Always mono 16-bit WAV in a `blob:` URL |
| Meter | iOS average power, Android peak level | Both mappings computed from the browser's samples |
| Gesture units | dp on Android, points on iOS | CSS pixels |
| Permission refused | `onPermissionDenied` | `onPermissionDenied`, then you can switch to the simulated voice |

The demo never uploads audio. Everything stays in the page and is discarded when you leave it.
