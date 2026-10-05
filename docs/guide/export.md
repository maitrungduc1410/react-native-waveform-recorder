---
description: "What onComplete returns: formats and MIME types per platform, how the 64 bars are computed, keeping the file and playing it with react-native-waveform-player."
---

# Export and the player {#export}

When a recording finishes, `onComplete` gives you a file and a compact summary of it:

```ts
onComplete={(e) => {
  e.uri;           // 'file:///.../wfr_....m4a'
  e.durationMs;    // 7340
  e.format;        // 'm4a'
  e.mimeType;      // 'audio/mp4'
  e.sizeBytes;     // 58123
  e.sampleRate;    // 44100
  e.channels;      // 1
  e.samples;       // 64 numbers in [0, 1]
  e.peakAmplitude; // 0.93
}}
```

## Formats {#formats}

Set the format with `output.format`. The file extension and `mimeType` depend on the platform:

| `format` | iOS file | iOS `mimeType` | Android file | Android `mimeType` |
| --- | --- | --- | --- | --- |
| `m4a` (default) | AAC in `.m4a` | `audio/mp4` | AAC in `.m4a` | `audio/mp4` |
| `aac` | AAC in `.m4a` | `audio/aac` | AAC in `.m4a` | `audio/mp4` |
| `wav` | 16-bit PCM `.wav` | `audio/wav` | 16-bit PCM `.wav` | `audio/wav` |
| `opus` | Opus in `.caf` | `audio/opus` | Opus in `.ogg` (API 29+) | `audio/ogg` |

- `m4a` is the safest choice for sharing and playback everywhere.
- `aac` records the same audio as `m4a`. Only the reported MIME type differs on iOS.
- `wav` is lossless and large. It is the only format that supports the [PCM stream](/guide/pcm-stream).
- `opus` gives the smallest files, but the containers differ: `.caf` on iOS is not widely playable outside Apple platforms. On Android below API 29 the engine records AAC instead and fires `onError` with code `'format-unsupported'`; the file keeps the `.ogg` name and `audio/ogg` type even though it contains AAC.

On Android `output.bitrate` is clamped by `output.quality`: 32 to 64 kbps for `low`, 64 to 128 kbps for `medium` and 96 to 256 kbps for `high`. On iOS the bitrate and quality are passed to the encoder as is.

## The 64-bar export {#the-64-bar-export}

`samples` is a ready-made waveform for a chat bubble, so the receiving side does not have to decode the audio. It is computed natively from the meter readings of the whole session:

1. The readings (one per meter tick, `meterUpdatesPerSecond` per second) are split into 64 equal groups in time.
2. Each group becomes the root mean square of its readings.
3. All 64 values are divided by the largest one, so the loudest bar is `1`.

Things to know:

- The values are relative. A quiet recording and a loud one both reach `1`. Use `peakAmplitude` if you need the absolute level.
- A recording with fewer than 64 readings (under about two seconds at the default 30 per second) leaves some groups empty, and those bars are `0`.
- Readings come from the meter, so they follow the platform's meter mapping (see [onMeter](/guide/events#onmeter)). The same sound gives slightly different shapes on iOS and Android.
- Very long sessions keep at most 16,384 readings; older ones are merged in pairs, keeping the louder value.

## Keep the file {#keep-the-file}

The file in `onComplete.uri` usually lives in the app's cache directory, and it still belongs to the recorder session:

- `cancel()`, also after `stop()`, deletes the session's segment files.
- Removing the view from the screen does the same: Android cleans up when the view is dropped, iOS when it is recycled.
- For a recording without a preview and continue step, the segment file **is** the delivered file.

So in `onComplete`, move or copy the file to a permanent location (for example the documents directory) or upload it before you cancel, start a different screen or unmount the recorder. Starting a new recording with `start()` does not delete the previous file.

## Play it with react-native-waveform-player {#play-it-with-the-player}

[react-native-waveform-player](https://maitrungduc1410.github.io/react-native-waveform-player/) is the playback half: the same pill, bars and timer, with play, pause, scrubbing and speed control. Pass the URI and the 64 bars, and the player skips decoding the file:

```tsx
import { AudioWaveformView } from 'react-native-waveform-player';

<AudioWaveformView
  source={{ uri: note.uri }}
  samples={note.samples}
  style={{ height: 56 }}
/>
```

Both libraries are independent and have no shared dependencies. If you send voice notes to other users, send `samples` along with the file (64 numbers are a few hundred bytes of JSON), so the receiving device can draw the bubble right away.
