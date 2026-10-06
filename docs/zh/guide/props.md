---
description: "WaveformRecorderView 的全部属性及其类型和原生默认值：输出格式、时长限制、波形条与背景样式、预览、手势、PCM、后台和静音检测。"
---

# 属性 {#props}

`WaveformRecorderView` 支持下列属性，以及 `style`、`testID` 等标准 `View` 属性。请为它设置高度，因为视图没有固有尺寸。事件属性见[事件](/zh/guide/events)。类型定义见 [API 参考](/api/type-aliases/WaveformRecorderViewProps)。

## 输出 {#output}

所有输出设置都放在一个嵌套的 `output` 属性中，每个字段都是可选的。

```tsx
<WaveformRecorderView
  output={{ format: 'm4a', sampleRate: 44100, channels: 1, bitrate: 128000, quality: 'high' }}
/>
```

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `uri` | `string` | 缓存目录中的一个文件 | 录音的 `file://` URI。只用于只有一个分段的录音，参阅[分段](/zh/guide/segments#where-files-go)。 |
| `format` | `'m4a' \| 'aac' \| 'wav' \| 'opus'` | `'m4a'` | 参阅[格式](/zh/guide/export#formats)。 |
| `sampleRate` | `number` | `44100` | 单位 Hz。 |
| `channels` | `1 \| 2` | `1` | |
| `bitrate` | `number` | `128000` | 单位 bit/s。`wav` 忽略此项。在 Android 上会按 `quality` 限制范围。 |
| `quality` | `'low' \| 'medium' \| 'high'` | `'high'` | iOS 上是编码器质量，Android 上是码率范围。 |

## 时长限制与采样节奏 {#recording-limits}

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `maxDurationMs` | `number` | `0` | 达到后自动停止：先触发 `onMaxDurationReached`，再触发 `onComplete`。`0` 表示不限制。 |
| `minDurationMs` | `number` | `0` | 如果调用 `stop()` 时录音短于该值，录音会被**丢弃**：状态回到 `idle`，并触发 code 为 `'min-duration'` 的 `onError`。 |
| `meterUpdatesPerSecond` | `number` | `30` | 读取电平并触发 `onMeter` 的频率，限制在 1 到 120 之间。 |
| `samplesPerSecond` | `number` | `12` | 每秒新增的波形条数。波形条在电平采样时添加，所以不会超过 `meterUpdatesPerSecond`。 |

## 波形条 {#bars}

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `playedBarColor` | `ColorValue` | 白色 | 录音时波形条的颜色，以及预览时已播放部分的颜色。 |
| `unplayedBarColor` | `ColorValue` | 50% 不透明度的白色 | 预览时未播放部分的颜色。 |
| `futureBarColor` | `ColorValue` | 更透明的 `unplayedBarColor` | `futureBarStyle` 占位标记的颜色。 |
| `barWidth` | `number` | `3` | 单位 dp 或 pt。 |
| `barGap` | `number` | `2` | 单位 dp 或 pt。 |
| `barRadius` | `number` | `-1` | 圆角半径。负数表示 `barWidth / 2`。 |
| `futureBarStyle` | `'hidden' \| 'dot' \| 'line'` | `'hidden'` | 波形条到达之前，左侧空位显示什么。 |
| `recordingMode` | `'scroll' \| 'morph' \| 'centered'` | `'scroll'` | 目前只实现了 `'scroll'`，其他值的效果与 `'scroll'` 相同。 |
| `newSampleEntry` | `'grow' \| 'fade' \| 'none'` | `'grow'` | 目前所有取值都使用生长动画。 |

## 背景与计时 {#pill-and-timer}

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `containerBackgroundColor` | `ColorValue` | `#3478F6` | 胶囊背景的颜色。 |
| `containerBorderRadius` | `number` | `16` | |
| `showBackground` | `boolean` | `true` | 设为 `false` 则只绘制波形条和计时，背景由你自己提供。 |
| `showTime` | `boolean` | `true` | 右侧的 `m:ss` 时间标签。 |
| `timeColor` | `ColorValue` | 白色 | |
| `timeMode` | `'count-up' \| 'count-down'` | `'count-up'` | `'count-down'` 在录音时显示距 `maxDurationMs` 的剩余时间，在预览时显示文件的剩余时间。没有设置 `maxDurationMs` 时，录音中仍然正向计时。 |

默认是蓝色背景上的白色波形条。如果在浅色页面上设置 `showBackground={false}`，请同时修改 `playedBarColor`、`unplayedBarColor` 和 `timeColor`。

## 预览 {#preview}

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `enablePreview` | `boolean` | `true` | 为 `false` 时，`enterPreview()` 会触发 code 为 `'preview-disabled'` 的 `onError`。 |
| `enableContinueRecording` | `boolean` | `true` | 为 `false` 时，在预览中调用 `resume()` 会触发 code 为 `'continue-disabled'` 的 `onError`。 |
| `showPlayButton` | `boolean` | `true` | 预览时背景内的播放和暂停按钮。 |
| `playButtonColor` | `ColorValue` | 白色 | |

## 手势 {#gestures}

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `enableSlideToCancel` | `boolean` | `false` | 向左拖动后触发 `onSlideCancel`。需要你自己调用 `cancel()`。 |
| `slideToCancelThresholdDp` | `number` | `80` | 水平距离，单位 dp 或 pt。 |
| `enableSlideToLock` | `boolean` | `false` | 向上拖动后触发 `onSlideLock`。 |
| `slideToLockThresholdDp` | `number` | `80` | 垂直距离，单位 dp 或 pt。 |

参阅[滑动手势](/zh/guide/gestures)。

## PCM 流 {#pcm-stream}

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `enablePcmStream` | `boolean` | `false` | 录音时触发 `onPcmChunk`。仅在 `output.format = 'wav'` 时有效。 |
| `pcmChunkMs` | `number` | `200` | 每个数据块的大致时长，单位 ms，最小 20。 |

参阅 [PCM 流](/zh/guide/pcm-stream)。

## 后台录音 {#background-recording}

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `backgroundRecording` | `boolean` | `false` | 需要原生配置，参阅[安装](/zh/guide/installation#background-recording)。 |
| `backgroundNotificationTitle` | `string` | `'Recording'` | 仅 Android。 |
| `backgroundNotificationBody` | `string` | `'Microphone recording in progress.'` | 仅 Android。 |

## 静音检测 {#silence-detection}

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `silenceThresholdDb` | `number` | `-160` | 低于该 dBFS 值时视为静音。默认值永远不会触发。 |
| `silenceTimeoutMs` | `number` | `0` | 电平需要持续低于阈值的时长。`0` 表示关闭检测。 |
| `autoStopOnSilence` | `boolean` | `false` | 检测到静音时停止并完成录音。 |

同时设置 `silenceThresholdDb` 和 `silenceTimeoutMs` 才能开启检测。参阅[静音检测](/zh/guide/silence-detection)。

## 受控状态 {#controlled-state}

`state` 是一个实验性的受控模式。设置后，ref 方法不再执行状态切换，只会通过 `onStateChange` 报告请求的状态；而修改该属性本身也不会开始或停止录音。请不要设置它，改用 [ref 方法](/zh/guide/ref-methods)。
