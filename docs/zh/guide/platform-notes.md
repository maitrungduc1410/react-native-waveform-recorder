---
description: "react-native-waveform-recorder 的平台差异：iOS 音频会话、Android 录音器与前台服务、电平数值、文件格式、布局和 Web。"
---

# 平台说明 {#platform-notes}

两个原生实现遵循相同的设计，但基于不同的音频 API。本页列出你可能会注意到的差异。

## iOS {#ios}

- **录音器。** 所有格式都用 `AVAudioRecorder` 录制，电平是它在上一个周期的平均功率。
- **音频会话。** 调用 `start()` 时，本库会把共享的 `AVAudioSession` 设置为 `playAndRecord` 类别，带 `defaultToSpeaker` 和 `allowBluetooth` 选项，并激活它；在 `stop()` 和 `cancel()` 之后停用会话。如果你的应用同时在播放其他音频，可能会受到影响，必要时请在之后重新配置会话。
- **中断。** 本库不监听电话等音频会话中断，也不监听应用状态变化。如有需要，请用 `AppState` 自行暂停或停止。
- **权限。** 系统弹窗在第一次 `start()` 时出现。用户拒绝后，iOS 不会再弹窗，之后每次 `start()` 都会触发 `onPermissionDenied`。
- **`output.uri`。** 必须是 `file://` URI，不接受普通路径。

## Android {#android}

- **录音器。** `m4a`、`aac` 和 `opus` 使用 `MediaRecorder`，电平是自上次采样以来的最大振幅。`wav` 使用 `AudioRecord` 加 16 位 PCM 写入器，电平是最新缓冲区的峰值。两者都使用 `MIC` 音频源。
- **权限。** 每次 `start()` 之前，JavaScript 层都会申请 `RECORD_AUDIO`。该权限已在本库的 manifest 中声明。
- **码率。** `output.bitrate` 会被限制在由 `output.quality` 决定的范围内，参阅[格式](/zh/guide/export#formats)。
- **Opus。** 需要 API 29。低于该版本时，引擎录制 AAC，并触发 code 为 `'format-unsupported'` 的 `onError`。
- **拖动定位。** 预览时视图会请求父视图不要拦截触摸，所以在 `ScrollView` 或 pager 中也能拖动定位。

## 后台录音 {#background-recording}

| | iOS | Android |
| --- | --- | --- |
| 让录音持续的机制 | `UIBackgroundModes` 中的 `audio` 项 | 类型为 `microphone` 的前台服务 |
| `backgroundRecording` 属性的作用 | 检查 `audio` 项，缺少时每次启动应用触发一次 code 为 `'background-capability'` 的 `onError` | 开始录音时启动服务，在 `stop()`、`cancel()` 或出错时停止服务 |
| 缺少原生配置时 | 应用进入后台后录音暂停 | 服务无法启动，本库只在 logcat 中输出警告 |

在 iOS 上，只要 `Info.plist` 中有该后台模式就会生效，与属性取值无关。在 Android 上，暂停和预览期间服务仍在运行。在 Android 13 及以上版本，只有应用拥有 `POST_NOTIFICATIONS` 权限时，服务通知才会显示在通知栏中；无论哪种情况服务都会运行。

## 电平数值 {#meter-values}

iOS 报告平均功率，Android 报告峰值，所以同一个声音在 Android 上的 `amplitude` 和 `db` 更高。这会影响波形条、`onMeter`、64 条波形导出以及[静音阈值](/zh/guide/silence-detection#choosing-a-threshold)。

## 布局 {#layout}

| | iOS | Android |
| --- | --- | --- |
| 内边距 | 12 pt | 12 dp |
| 预览播放按钮 | 视图高度的 60%，最大 36 pt | 32 dp |
| 时间标签 | 宽 48 pt，13 pt semibold | 宽 48 dp，13 sp |
| 默认 `futureBarColor` | 不透明度 60% 的 `unplayedBarColor` | 不透明度乘以 0.6 的 `unplayedBarColor` |

## Fabric 生命周期 {#fabric-lifecycle}

- 在 iOS 上，`display: 'none'` 会卸载原生视图：ref 变为 `null`，调用丢失，会话文件被清理。如果视图必须保持挂载，请把它移到屏幕外。
- 视图被移除时（iOS 回收、Android `onDropViewInstance`），录音会被取消，分段文件会被删除，参阅[保存文件](/zh/guide/export#keep-the-file)。

## Web {#web}

本包提供了 Web 入口，以便共享代码仍能打包，但在 Web 上渲染 `WaveformRecorderView` 会抛出错误，`ensureMicrophonePermission()` 返回 `false`。请在 Web 上渲染其他内容，例如放在 `Platform.OS !== 'web'` 判断之后。
