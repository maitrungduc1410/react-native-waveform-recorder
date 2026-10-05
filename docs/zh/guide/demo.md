---
description: "在浏览器中试用 react-native-waveform-recorder 的网页近似版：麦克风实时波形、暂停、带拖动定位的预览、滑动手势及其触发的事件。"
---

# 浏览器演示 {#browser-demo}

本库只能在 iOS 和 Android 上运行，所以本页使用一个网页近似版。它在 canvas 上以相同的布局、波形条动画和默认值重绘原生视图，并对 ref 方法执行相同的状态规则。你可以用它熟悉各个属性，并观察哪些事件会在什么时候触发。

<ClientOnly>
  <RecorderDemo />
</ClientOnly>

## 可以试试 {#what-to-try}

- 点击 `start()` 然后说话。波形条按 `samplesPerSecond` 从右侧进入，`onMeter` 每秒更新 `meterUpdatesPerSecond` 次。
- 录音时在视图上拖动。向左拖动会报告 `cancelProgress`，超过 `slideToCancelThresholdDp` 时触发 `onSlideCancel`，演示随即调用 `cancel()`，和你的应用要做的一样。向上拖动会触发 `onSlideLock`；“已锁定”标签属于宿主应用的界面，本库不会为它绘制任何内容。
- 点击 `enterPreview()`，然后播放并在波形条上拖动定位。在预览中调用 `resume()` 会开始一个新分段。
- 打开静音检测，保持安静，观察 `onSilenceDetected`。
- 把 `maxDurationMs` 设为 `10000`，可以看到先触发 `onMaxDurationReached`，再触发 `onComplete`。
- 关闭 `enablePreview` 或 `enableContinueRecording`，查看对应的 `onError` code。

## 与原生视图的区别 {#how-it-differs}

| | 原生视图 | 本演示 |
| --- | --- | --- |
| 音频输入 | `AVAudioRecorder`、`MediaRecorder` 或 `AudioRecord` | `getUserMedia` 和 Web Audio，或模拟人声 |
| 输出文件 | 默认 `m4a`，参阅 [`output`](/zh/guide/props#output) | 始终是 `blob:` URL 中的单声道 16 位 WAV |
| 电平 | iOS 为平均功率，Android 为峰值 | 用浏览器采样同时计算两种映射 |
| 手势单位 | Android 为 dp，iOS 为 pt | CSS 像素 |
| 权限被拒绝 | `onPermissionDenied` | `onPermissionDenied`，之后可以切换到模拟人声 |

演示不会上传任何音频。所有内容都留在页面中，离开页面后即被丢弃。
