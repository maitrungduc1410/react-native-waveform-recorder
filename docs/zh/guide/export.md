---
description: "onComplete 返回什么：各平台的文件格式和 MIME 类型、64 条波形的计算方式、如何保住文件，以及用 react-native-waveform-player 播放。"
---

# 导出数据与播放器 {#export}

录音完成后，`onComplete` 会给你一个文件和它的简要摘要：

```ts
onComplete={(e) => {
  e.uri;           // 'file:///.../wfr_....m4a'
  e.durationMs;    // 7340
  e.format;        // 'm4a'
  e.mimeType;      // 'audio/mp4'
  e.sizeBytes;     // 58123
  e.sampleRate;    // 44100
  e.channels;      // 1
  e.samples;       // 64 个 [0, 1] 范围内的数
  e.peakAmplitude; // 0.93
}}
```

## 格式 {#formats}

通过 `output.format` 设置格式。文件扩展名和 `mimeType` 因平台而异：

| `format` | iOS 文件 | iOS `mimeType` | Android 文件 | Android `mimeType` |
| --- | --- | --- | --- | --- |
| `m4a`（默认） | `.m4a` 中的 AAC | `audio/mp4` | `.m4a` 中的 AAC | `audio/mp4` |
| `aac` | `.m4a` 中的 AAC | `audio/aac` | `.m4a` 中的 AAC | `audio/mp4` |
| `wav` | 16 位 PCM `.wav` | `audio/wav` | 16 位 PCM `.wav` | `audio/wav` |
| `opus` | `.caf` 中的 Opus | `audio/opus` | `.ogg` 中的 Opus（API 29+） | `audio/ogg` |

- `m4a` 最适合分享和在各处播放。
- `aac` 录出的音频与 `m4a` 相同，只有 iOS 上报告的 MIME 类型不同。
- `wav` 无损但体积大，也是唯一支持 [PCM 流](/zh/guide/pcm-stream)的格式。
- `opus` 文件最小，但容器不同：iOS 上的 `.caf` 在苹果平台之外很难播放。在 API 29 以下的 Android 上，引擎改为录制 AAC 并触发 code 为 `'format-unsupported'` 的 `onError`；文件仍然叫 `.ogg`、类型仍是 `audio/ogg`，但内容是 AAC。

在 Android 上，`output.bitrate` 会按 `output.quality` 限制范围：`low` 为 32 到 64 kbps，`medium` 为 64 到 128 kbps，`high` 为 96 到 256 kbps。在 iOS 上，码率和质量会原样传给编码器。

## 64 条波形导出 {#the-64-bar-export}

`samples` 是为聊天气泡准备好的波形，接收方无需解码音频。它在原生端根据整个会话的电平读数计算：

1. 把所有读数（每个采样周期一个，每秒 `meterUpdatesPerSecond` 个）按时间平均分成 64 组。
2. 每组取其读数的均方根（RMS）。
3. 64 个值都除以其中的最大值，所以最响的一条为 `1`。

需要注意：

- 这些值是相对的。无论录音小声还是大声，最高的一条都是 `1`。如需绝对电平，请使用 `peakAmplitude`。
- 读数少于 64 个的录音（按默认每秒 30 次，大约短于两秒）会有空组，对应的波形条为 `0`。
- 读数来自电平，所以遵循各平台的电平映射（参阅 [onMeter](/zh/guide/events#onmeter)）。同一段声音在 iOS 和 Android 上的形状会略有不同。
- 很长的会话最多保留 16,384 个读数，更早的读数会两两合并，保留较大的值。

## 保存文件 {#keep-the-file}

`onComplete.uri` 指向的文件通常位于应用的缓存目录，并且仍然属于录音会话：

- `cancel()`（包括在 `stop()` 之后调用）会删除本次会话的分段文件。
- 把视图从屏幕上移除也是如此：Android 在视图被 drop 时清理，iOS 在视图被回收时清理。
- 对于没有经过预览后继续录音的录音，分段文件**就是**交给你的那个文件。

所以请在 `onComplete` 中把文件移动或复制到持久位置（例如 documents 目录），或者上传，然后再调用 `cancel()`、跳转页面或卸载录音视图。用 `start()` 开始新录音不会删除之前的文件。

## 用 react-native-waveform-player 播放 {#play-it-with-the-player}

[react-native-waveform-player](https://maitrungduc1410.github.io/react-native-waveform-player/) 负责播放这一半：同样的胶囊背景、波形条和计时，支持播放、暂停、拖动定位和倍速。传入 URI 和 64 条波形，播放器就会跳过文件解码：

```tsx
import { AudioWaveformView } from 'react-native-waveform-player';

<AudioWaveformView
  source={{ uri: note.uri }}
  samples={note.samples}
  style={{ height: 56 }}
/>
```

两个库彼此独立，没有共享依赖。如果要把语音消息发给其他用户，请把 `samples` 和文件一起发送（64 个数字只有几百字节的 JSON），这样接收方设备可以立即绘制气泡。
