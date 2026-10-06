---
description: "Stream raw 16-bit PCM from react-native-waveform-recorder while recording WAV, decode base64 chunks with the pcm-stream helpers and feed speech-to-text."
---

# PCM stream {#pcm-stream}

While recording, the recorder can send you the raw audio in small chunks, for example to run speech recognition or voice activity detection while the user is still talking.

```tsx
import { WaveformRecorderView } from 'react-native-waveform-recorder';
import {
  decodePcmChunk,
  pcmToMonoFloat32,
} from 'react-native-waveform-recorder/pcm-stream';

<WaveformRecorderView
  ref={ref}
  style={{ height: 56 }}
  output={{ format: 'wav', sampleRate: 16000, channels: 1 }}
  enablePcmStream
  pcmChunkMs={100}
  onPcmChunk={(e) => {
    const int16 = decodePcmChunk(e.chunk);
    const float32 = pcmToMonoFloat32(int16, e.channels);
    vad.push(float32, e.sampleRate);
  }}
/>;
```

## Requirements {#requirements}

- `output.format` must be `'wav'`. With any other format `enablePcmStream` is ignored and no chunk is sent.
- Set `enablePcmStream` before `start()`. The setting is read when a segment starts recording.
- The recording file is still written as usual and `onComplete` still fires.

## The chunk {#the-chunk}

| Field | Meaning |
| --- | --- |
| `chunk` | Base64 string of interleaved little-endian 16-bit PCM. |
| `sampleRate` | Sample rate in Hz, from `output.sampleRate`. |
| `channels` | Channel count. |
| `bytesPerSample` | Always `2`. |
| `timestampMs` | Recorded time when the chunk was sent, in ms. |

`pcmChunkMs` (default `200`, minimum `20`) sets the approximate chunk length:

- **iOS** reads new bytes from the WAV file every `pcmChunkMs`, at most 256 KB per chunk.
- **Android** collects samples from `AudioRecord` until it has about `pcmChunkMs` of audio, then sends them. The remaining samples are sent when recording stops.

## Helpers {#helpers}

The helpers live in the `react-native-waveform-recorder/pcm-stream` subpath, so apps that do not import them do not ship them.

| Function | What it does |
| --- | --- |
| `decodePcmChunk(chunk)` | Decodes the base64 payload into an `Int16Array`. Uses `globalThis.atob` when available and a built-in decoder otherwise. |
| `pcmToMonoFloat32(int16, channels)` | Converts interleaved Int16 into mono `Float32Array` in `[-1, 1]`. Stereo pairs are averaged. |

See the [API reference](/api/pcm-stream/) for signatures.

## Limits {#limits}

- Chunks cross the bridge as base64 strings. That is fine for speech at 16 kHz mono (32 KB per second), but for several MB per second consider a JSI audio library such as [react-native-audio-api](https://github.com/software-mansion/react-native-audio-api).
- On iOS, after `pause()` and `resume()` the stream starts reading the current file from the beginning again, so audio sent before the pause can be sent a second time. On iOS the last partial chunk before `pause()` or `stop()` is not sent. If exact continuity matters, use the final WAV file from `onComplete` as the source of truth.
- Chunks are delivered on the JavaScript thread. Keep `onPcmChunk` light and hand heavy work to a worker or native module.
