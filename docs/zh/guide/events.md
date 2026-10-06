---
description: "WaveformRecorderView 的事件：状态变化、电平、带 64 条波形的完成事件、错误及其 code、预览、滑动手势、静音和 PCM。"
---

# 事件 {#events}

所有事件都是 `WaveformRecorderView` 的属性。事件数据的类型见 [API 参考](/api/)。

| 事件 | 数据 | 触发时机 |
| --- | --- | --- |
| `onStateChange` | `{ state, durationMs }` | 每次状态变化。 |
| `onMeter` | `{ amplitude, peak, db }` | 录音时每秒 `meterUpdatesPerSecond` 次。 |
| `onComplete` | 见[下文](#oncomplete) | `stop()` 或自动停止后，最终文件写好时触发一次。 |
| `onMaxDurationReached` | 无 | 达到 `maxDurationMs` 时，在自动停止之前。 |
| `onPermissionDenied` | 无 | `start()` 无法获得麦克风权限时。 |
| `onError` | `{ message, code? }` | 警告和失败，见[错误 code](#error-codes)。 |
| `onSeek` | `{ positionMs }` | 预览中拖动定位结束时，以及调用 `seekPreview()` 之后。 |
| `onPlaybackTimeUpdate` | `{ positionMs, durationMs }` | 预览音频播放时，每秒约 30 次。 |
| `onSlideProgress` | `{ cancelProgress, lockProgress }` | 录音时用户在视图上拖动期间。 |
| `onSlideCancel` | 无 | 每次拖动中越过取消阈值时触发一次。 |
| `onSlideLock` | 无 | 每次拖动中越过锁定阈值时触发一次。 |
| `onSilenceDetected` | `{ durationMs }` | 每段静音触发一次，参阅[静音检测](/zh/guide/silence-detection)。 |
| `onPcmChunk` | `{ chunk, sampleRate, channels, bytesPerSample, timestampMs }` | 开启 PCM 流时约每 `pcmChunkMs` 一次，参阅 [PCM 流](/zh/guide/pcm-stream)。 |

## onStateChange {#onstatechange}

`state` 取值为 `'idle'`、`'recording'`、`'paused'`、`'preview'`、`'stopped'` 或 `'error'`。`durationMs` 是目前为止已录制的时长，不包括暂停的时间。状态流转参阅[分段、暂停与预览](/zh/guide/segments#states)。

## onMeter {#onmeter}

| 字段 | 含义 |
| --- | --- |
| `amplitude` | 当前电平，范围 `[0, 1]`，也就是最新一根波形条使用的值。 |
| `peak` | 本次会话迄今为止最大的 `amplitude`。 |
| `db` | 当前电平，单位 dBFS。`0` 为满刻度，越安静越负。 |

两个平台测量电平的方式不同，所以同一个声音会得到不同的数值。iOS 报告上一个采样周期的平均功率，并按 `10^(db / 20)` 映射，-60 dB 及以下一律显示为 `0`。Android 报告自上次采样以来的峰值，并取线性峰值的平方根。不要跨平台比较原始数值。

## onComplete {#oncomplete}

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `uri` | `string` | 录音文件的 `file://` URI。 |
| `durationMs` | `number` | 录音时长，所有分段之和。 |
| `format` | `string` | 你设置的 `output.format`。 |
| `mimeType` | `string` | MIME 类型，参阅[格式](/zh/guide/export#formats)。 |
| `sizeBytes` | `number` | 文件大小。 |
| `sampleRate` | `number` | 采样率，单位 Hz。 |
| `channels` | `number` | 声道数。 |
| `samples` | `number[]` | 64 个 `[0, 1]` 范围内的值，用于聊天气泡，参阅[导出](/zh/guide/export#the-64-bar-export)。 |
| `peakAmplitude` | `number` | 本次会话最大的电平 `amplitude`。 |

在什么都没录到、调用了 `cancel()`，或者录音被 `minDurationMs` 丢弃时，`onComplete` 不会触发。

## 错误 code {#error-codes}

`onError` 既用于真正的失败，也用于提醒某个调用被忽略。请检查 `code`：

| Code | 含义 |
| --- | --- |
| `start` | 录音器无法启动，状态变为 `'error'`。 |
| `session` | iOS 无法配置音频会话，状态变为 `'error'`。 |
| `resume` | `pause()` 之后继续录音失败，状态变为 `'error'`。 |
| `media-recorder` | Android：录音过程中 `MediaRecorder` 报告了错误。 |
| `min-duration` | 调用 `stop()` 时未达到 `minDurationMs`，录音已被丢弃。 |
| `preview-disabled` | 在 `enablePreview={false}` 时调用了 `enterPreview()`。 |
| `continue-disabled` | 在 `enableContinueRecording={false}` 时于预览中调用了 `resume()`。 |
| `preview-snapshot` | 无法准备预览，例如还没有录到任何内容。 |
| `preview-load` | 预览播放器无法加载音频。 |
| `concat` | 合并分段失败。`onComplete` 仍会带着第一个分段触发，避免音频全部丢失。 |
| `format-unsupported` | 在 API 29 以下的 Android 上请求了 `opus`，引擎改为录制 AAC。 |
| `pcm-stream` | iOS：PCM 流无法打开 WAV 文件。 |
| `background-capability` | iOS：开启了 `backgroundRecording`，但 `UIBackgroundModes` 中缺少 `audio`。只触发一次。 |

处于 `'error'` 状态时，调用 `start()` 会开始一个新会话。
