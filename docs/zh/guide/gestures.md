---
description: "为 react-native-waveform-recorder 录音视图添加左滑取消和上滑锁定：阈值、进度事件、两个手势如何竞争，以及应用在每个事件中要做什么。"
---

# 滑动手势 {#slide-gestures}

聊天应用通常允许用户向左拖动来丢弃录音，向上拖动来锁定录音，这样松开手指后仍会继续录音。录音视图在原生端跟踪这两种拖动，并告诉你发生了什么，具体怎么处理由你的应用决定。

```tsx
const [locked, setLocked] = useState(false);

<WaveformRecorderView
  ref={ref}
  style={{ height: 56 }}
  enableSlideToCancel
  enableSlideToLock
  onSlideProgress={(e) => {
    cancelHint.setValue(e.cancelProgress);
    lockHint.setValue(e.lockProgress);
  }}
  onSlideCancel={() => ref.current?.cancel()}
  onSlideLock={() => setLocked(true)}
/>
```

## 工作原理 {#how-it-works}

- 拖动**在录音视图本身**上跟踪，并且只在状态为 `recording` 时生效。从其他视图（例如单独的录音按钮）开始的触摸不会被识别。被关闭的手势进度始终为 `0`。
- 进度等于拖动距离除以阈值，限制在 `[0, 1]`：手指向左移动时 `cancelProgress` 增大，向上移动时 `lockProgress` 增大。向右或向下移动按 `0` 计算。
- 每次移动都会触发 `onSlideProgress`。拖动开始时它报告 `0, 0`，手指在没有越过任何阈值的情况下抬起时也会再次报告，方便你重置提示。
- 某个进度达到 `1` 时，对应事件触发**一次**，本次拖动随即结束。如果两者在同一次移动中同时达到 `1`，取消优先。
- 阈值在 Android 上以 dp 为单位，在 iOS 上以 pt 为单位。Android 还会等待超过系统的 touch slop 之后才算开始拖动。

| 属性 | 默认值 |
| --- | --- |
| `enableSlideToCancel` | `false` |
| `slideToCancelThresholdDp` | `80` |
| `enableSlideToLock` | `false` |
| `slideToLockThresholdDp` | `80` |

## 你的应用要做什么 {#what-your-app-does}

**收到 `onSlideCancel`：** 本库**不会**自动取消。调用 `ref.current?.cancel()` 丢弃录音，或者做别的处理，例如弹窗确认。

**收到 `onSlideLock`：** 本库不做任何改变，录音照常继续。显示你自己的锁定界面，例如停止按钮和“已锁定”标记。手指抬起后不需要额外操作就能继续录音，因为触摸结束时录音视图不会停止。

**提示：** 视图不会绘制“滑动取消”文字或锁形图标。用 `onSlideProgress` 自己做动画，例如随着 `cancelProgress` 增大逐渐淡出一段文字。

## 按住录音 {#hold-to-record}

内置手势只跟踪**录音开始之后、从录音视图上开始的触摸**。调用 `start()` 时已经按下的手指（例如按住录音按钮的手指）不会被识别，即使录音视图正好出现在手指下方也一样。

如果要做“按住录音”的交互，请在你自己的录音按钮上跟踪拖动（使用 `PanResponder` 或 `react-native-gesture-handler`）：按下时调用 `start()`，手指向左移动足够远时调用 `cancel()`，松开时按你的设计继续录音或调用 `stop()`。内置手势适合“先点击录音，再在录音视图上拖动”的交互。

你可以在[浏览器演示](/zh/guide/demo)中用鼠标或手指试用这两个手势。
