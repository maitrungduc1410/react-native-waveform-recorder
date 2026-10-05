---
description: "react-native-waveform-recorder 常见问题的解决方法：无法录音、文件丢失、波形条异常、手势不触发、检测不到静音和 Expo 构建问题。"
---

# 故障排查 {#troubleshooting}

## 调用 start() 没有反应 {#start-does-nothing}

- 检查 `onPermissionDenied` 和 `onError`。权限被拒绝会触发 `onPermissionDenied`，录音器失败会触发 code 为 `'start'` 或 `'session'` 的 `onError`。
- 在 iOS 上，用户拒绝过一次麦克风权限后，弹窗就不会再出现。请用 `Linking.openSettings()` 引导用户去设置。
- 确认 `Info.plist` 中有 `NSMicrophoneUsageDescription`。缺少它时，iOS 会在开始录音时终止应用。
- 确认 ref 已经赋值。在 iOS 上，父视图设置了 `display: 'none'` 的录音视图会被卸载，ref 为 `null`。
- 检查是否设置了 `state` 属性。它会让视图进入实验性的受控模式，此时 ref 方法不会录音，参阅[受控状态](/zh/guide/props#controlled-state)。

## 视图是空的或没有高度 {#no-height}

视图没有固有尺寸。请在 `style` 中设置高度，例如 `height: 56`。

## onComplete 给出的文件不见了 {#file-is-gone}

`cancel()`（包括在 `stop()` 之后调用）和卸载视图都会删除本次会话的分段文件；对于没有经过预览后继续录音的录音，这就是交给你的那个文件。请在 `onComplete` 中复制或移动文件，参阅[保存文件](/zh/guide/export#keep-the-file)。另外，系统也可能清理缓存目录。

## stop() 丢弃了录音 {#stop-discarded}

设置了 `minDurationMs`，而录音比它短。状态回到 `idle`，并触发 code 为 `'min-duration'` 的 `onError`。请调低或去掉 `minDurationMs`，或者在收到这个 code 时给用户提示。

## output.uri 没有生效 {#output-uri-ignored}

- 在 iOS 上请传入 `file://` URI，而不是普通路径。
- 预览后继续录音时，结果是缓存目录中新的合并文件，而不是 `output.uri`。请使用 `onComplete.uri`。

## 波形条几乎不动或跳动太大 {#bars}

波形条跟随各平台的电平：iOS 为平均功率，Android 为峰值。iOS 上小声说话时波形条可能贴近底部，因为 -60 dB 及以下都会画成 `0`。可以用 `samplesPerSecond`、`barWidth` 和 `barGap` 调整视觉密度。目前 `recordingMode` 和 `newSampleEntry` 没有可见效果。

## 滑动手势不触发 {#gestures-do-not-fire}

- 开启 `enableSlideToCancel` 和/或 `enableSlideToLock`，两者默认都是 `false`。
- 拖动必须在状态为 `recording` 时**从录音视图上**开始。录音开始前就已按下的手指（例如按住的按钮）不会被跟踪。参阅[按住录音](/zh/guide/gestures#hold-to-record)。
- `onSlideCancel` 不会自动取消，请在回调中调用 `ref.current?.cancel()`。

## 一直检测不到静音 {#silence-never-detected}

同时设置 `silenceThresholdDb` 和 `silenceTimeoutMs`，默认值（`-160` 和 `0`）永远不会触发。如果仍不触发，说明环境比阈值更吵；记录 `onMeter` 后调高阈值，参阅[选择阈值](/zh/guide/silence-detection#choosing-a-threshold)。

## 收不到 PCM 数据块 {#no-pcm-chunks}

`enablePcmStream` 只在 `output.format` 为 `'wav'` 时有效，并且必须在 `start()` 之前开启。

## 切到后台后录音停止 {#background}

设置 `backgroundRecording`，并完成[安装](/zh/guide/installation#background-recording)中的原生配置。在 iOS 上留意 code 为 `'background-capability'` 的 `onError`。在 Android 上查看 logcat 中是否有 `startForegroundService failed` 警告，它表示服务未声明。

## Opus 文件无法播放 {#opus}

iOS 把 Opus 写在 `.caf` 容器中，许多非苹果平台的播放器打不开。在 API 29 以下的 Android 上，文件虽然叫 `.ogg`，实际是 AAC。如果文件需要跨平台分享，请使用 `m4a`。

## Expo：找不到模块 {#expo}

本库不能在 Expo Go 中运行。添加配置插件后，运行 `npx expo prebuild --clean` 并构建开发客户端。参阅 [Expo](/zh/guide/installation#expo)。

## 在 Web 上渲染报错 {#web}

该视图仅支持原生平台。请在 Web 上渲染替代内容，参阅[平台说明](/zh/guide/platform-notes#web)。
