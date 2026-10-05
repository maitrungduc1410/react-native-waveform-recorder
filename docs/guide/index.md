---
description: "What react-native-waveform-recorder does: a Fabric recorder view with a native live waveform, preview, slide gestures, silence detection and a 64-bar export."
---

# What is react-native-waveform-recorder? {#what-is-it}

`react-native-waveform-recorder` is a React Native view that records audio from the microphone and draws a live waveform while it records. It is the recording half of a voice-message feature: the user records, optionally listens back and keeps going, and you get a finished audio file together with a 64-bar summary of its loudness for the chat bubble.

Everything that runs per frame is native. The microphone level is read in Swift (`AVAudioRecorder`) and Kotlin (`MediaRecorder` or `AudioRecord`), and the bars are drawn by a native view. JavaScript only sends commands through a [ref](/guide/ref-methods) and receives [events](/guide/events).

## Features {#features}

| Feature | Where |
| --- | --- |
| Live waveform with configurable bars, colors, timer and placeholder ticks | [Props](/guide/props) |
| Pause and resume, preview with scrubbing, continue recording after preview | [Segments, pause and preview](/guide/segments) |
| Slide to cancel and slide to lock | [Slide gestures](/guide/gestures) |
| Event after a quiet stretch, optional automatic stop | [Silence detection](/guide/silence-detection) |
| `m4a`, `aac`, `wav` and `opus` output, 64 bars for a chat bubble | [Export and the player](/guide/export) |
| 16-bit PCM chunks while recording | [PCM stream](/guide/pcm-stream) |
| Recording in the background | [Platform notes](/guide/platform-notes#background-recording) |

## Platforms {#platforms}

| | Support |
| --- | --- |
| iOS | Yes (Swift, AVFoundation). Minimum version follows your React Native release. |
| Android | Yes (Kotlin), API 24 or later. `opus` output needs API 29. |
| New Architecture (Fabric) | Required. There is no Old Architecture implementation. |
| Expo | Development builds and `expo prebuild`, with a config plugin. Not Expo Go. |
| Web | No. Rendering the view on web throws an error. |

The library has no JavaScript dependencies besides React Native itself.

## How it fits together {#how-it-fits-together}

1. Render `<WaveformRecorderView>` with a height in its `style`, for example `height: 56`.
2. Call `ref.current?.start()` from your record button. The library asks for microphone permission first.
3. While recording, the view draws bars and fires `onMeter`. You can `pause()`, `resume()`, `enterPreview()` to listen back, or `cancel()`.
4. Call `stop()`. The view finalises the file and fires `onComplete` with its `file://` URI, duration, size, format and 64 `samples`.
5. Show the result with [react-native-waveform-player](https://maitrungduc1410.github.io/react-native-waveform-player/), passing the URI and the samples.

::: warning Keep the file before you cancel or unmount
`cancel()` and removing the view from the screen delete the session's recording files. For a recording without a preview-and-continue step, that includes the file `onComplete` gave you. Copy or move the file in `onComplete` if you need it later. See [Export and the player](/guide/export#keep-the-file).
:::

## Next steps {#next-steps}

- [Installation](/guide/installation): permissions, background recording and the Expo config plugin.
- [Quick start](/guide/quick-start): a working record, preview and send screen.
- [Browser demo](/guide/demo): try the props and events with your own microphone.
