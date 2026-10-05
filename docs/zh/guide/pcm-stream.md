---
description: "录制 WAV 时从 react-native-waveform-recorder 获取原始 16 位 PCM，用 pcm-stream 工具函数解码 base64 数据块，再交给语音识别或 VAD。"
---

# PCM 流 {#pcm-stream}

录音时，视图可以把原始音频以小数据块的形式发给你，例如在用户还在说话时运行语音识别或语音活动检测（VAD）。

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

## 要求 {#requirements}

- `output.format` 必须是 `'wav'`。使用其他格式时，`enablePcmStream` 会被忽略，不会发送任何数据块。
- 在 `start()` 之前开启 `enablePcmStream`。该设置在分段开始录音时读取。
- 录音文件照常写入，`onComplete` 照常触发。

## 数据块 {#the-chunk}

| 字段 | 含义 |
| --- | --- |
| `chunk` | base64 字符串，内容为声道交错的小端 16 位 PCM。 |
| `sampleRate` | 采样率，单位 Hz，来自 `output.sampleRate`。 |
| `channels` | 声道数。 |
| `bytesPerSample` | 始终为 `2`。 |
| `timestampMs` | 发送该数据块时已录制的时长，单位 ms。 |

`pcmChunkMs`（默认 `200`，最小 `20`）设置每个数据块的大致时长：

- **iOS** 每隔 `pcmChunkMs` 从 WAV 文件读取新字节，每块最多 256 KB。
- **Android** 从 `AudioRecord` 收集采样，攒够约 `pcmChunkMs` 的音频后发送。停止录音时会发送剩余部分。

## 工具函数 {#helpers}

这些工具函数位于 `react-native-waveform-recorder/pcm-stream` 子路径中，不导入它们的应用就不会打包它们。

| 函数 | 作用 |
| --- | --- |
| `decodePcmChunk(chunk)` | 把 base64 数据解码为 `Int16Array`。有 `globalThis.atob` 时使用它，否则使用内置解码器。 |
| `pcmToMonoFloat32(int16, channels)` | 把声道交错的 Int16 转为 `[-1, 1]` 范围内的单声道 `Float32Array`。立体声会对左右声道取平均。 |

函数签名见 [API 参考](/api/react-native-waveform-recorder/pcm-stream/)。

## 限制 {#limits}

- 数据块以 base64 字符串的形式经过 bridge。对于 16 kHz 单声道语音（每秒 32 KB）没有问题，但如果需要每秒几 MB，可以考虑使用基于 JSI 的音频库，例如 [react-native-audio-api](https://github.com/software-mansion/react-native-audio-api)。
- 在 iOS 上，`pause()` 再 `resume()` 之后，数据流会从头重新读取当前文件，所以暂停前已发送的音频可能会再发送一次。同样在 iOS 上，`pause()` 或 `stop()` 之前最后一个不完整的数据块不会发送。如果对连续性要求很高，请以 `onComplete` 给出的最终 WAV 文件为准。
- 数据块在 JavaScript 线程上派发。请让 `onPcmChunk` 尽量轻量，把繁重的处理交给 worker 或原生模块。
