---
description: "WaveformRecorderView 的 ref 方法：从 start、pause、stop 到 cancel、enterPreview 和 seekPreview，以及每个方法在哪些状态下生效。"
---

# ref 方法 {#ref-methods}

通过类型为 `WaveformRecorderViewRef` 的 ref 控制录音视图：

```tsx
const ref = useRef<WaveformRecorderViewRef>(null);

<WaveformRecorderView ref={ref} style={{ height: 56 }} />;

ref.current?.start();
```

这些方法没有返回值，请通过 `onStateChange` 了解发生了什么。与当前状态不符的调用会被忽略，但会报告 [`onError` code](/zh/guide/events#error-codes) 的情况除外。

| 方法 | 生效状态 | 作用 |
| --- | --- | --- |
| `start()` | `idle`、`stopped`、`error`、`paused` | 申请麦克风权限，然后开始新的录音。在 `paused` 状态下则继续当前录音。 |
| `pause()` | `recording` | 暂停。`resume()` 后继续写入同一个文件。 |
| `resume()` | `paused`、`preview` | 在 `paused` 状态下继续当前分段。在 `preview` 状态下停止播放器并录制新分段。 |
| `stop()` | `recording`、`paused`、`preview` | 完成录音，合并分段并触发 `onComplete`。 |
| `cancel()` | 任意 | 丢弃本次会话，删除其文件并回到 `idle`。 |
| `enterPreview()` | `recording`、`paused` | 必要时先暂停，然后把目前录到的全部内容加载到内置播放器。 |
| `exitPreview()` | `preview` | 退出预览，回到 `paused`。 |
| `togglePreviewPlayback()` | `preview` | 播放或暂停预览音频。 |
| `seekPreview(positionMs)` | `preview` | 移动预览播放位置并触发 `onSeek`。 |

## start() {#start}

在 Android 上，JavaScript 层会先检查并申请 `RECORD_AUDIO`。在 iOS 上，原生端会在第一次调用时显示系统弹窗。如果权限被拒绝，会触发 `onPermissionDenied`，状态保持不变。

在 `idle`、`stopped` 或 `error` 状态下，`start()` 会开始一个全新的会话。`stop()` 之后再次开始不会删除之前的文件，但之后的 `cancel()` 或卸载可能会删除，参阅[保存文件](/zh/guide/export#keep-the-file)。

## stop() {#stop}

`stop()` 在文件就绪之前就会返回。只有一个分段时，`onComplete` 立即触发；有多个分段时，先合并文件再触发 `onComplete`。如果什么都没录到，状态变为 `stopped`，但不会触发 `onComplete`。

如果设置了 `minDurationMs`，并且在录音或暂停状态下调用 `stop()` 时录音短于该值，录音会被丢弃：文件被删除，状态回到 `idle`，并触发 code 为 `'min-duration'` 的 `onError`。

## cancel() {#cancel}

`cancel()` 会停止一切并删除本次会话的分段文件。它在 `stop()` 之后同样有效，这时可能会删除 `onComplete` 交给你的文件。如果还需要这个文件，请先复制。

## 在隐藏的视图上调用方法 {#hidden-view}

在 iOS 上，`display: 'none'` 会卸载原生视图，导致 ref 为 `null`、调用丢失，录音文件也会被清理。如果需要让录音视图保持挂载但不可见，请把它移到屏幕外，例如 `position: 'absolute', left: -100000`。
