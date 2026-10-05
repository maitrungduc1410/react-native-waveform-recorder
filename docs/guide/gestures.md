---
description: "Add slide-to-cancel and slide-to-lock to the waveform recorder: thresholds, progress events, how the two gestures compete and what your app has to do on each."
---

# Slide gestures {#slide-gestures}

Messaging apps often let the user drag left to throw a recording away and drag up to lock it, so they can let go and keep recording. The recorder tracks both drags natively and tells you what happened. Your app decides what to do.

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

## How it works {#how-it-works}

- The drag is tracked **on the recorder view itself**, and only while the state is `recording`. A touch that starts on another view, such as a separate record button, is not seen. A disabled gesture always reports `0` progress.
- Progress is the drag distance divided by the threshold, clamped to `[0, 1]`: `cancelProgress` grows as the finger moves left, `lockProgress` as it moves up. Moving right or down counts as `0`.
- `onSlideProgress` fires on every move. It reports `0, 0` when the drag starts, and again when the finger lifts without crossing a threshold, so you can reset your hints.
- When a progress value reaches `1`, the matching event fires **once** and the drag ends. If both reach `1` on the same move, cancel wins.
- Thresholds are in dp on Android and points on iOS. Android also waits for the system touch slop before a drag counts.

| Prop | Default |
| --- | --- |
| `enableSlideToCancel` | `false` |
| `slideToCancelThresholdDp` | `80` |
| `enableSlideToLock` | `false` |
| `slideToLockThresholdDp` | `80` |

## What your app does {#what-your-app-does}

**On `onSlideCancel`:** the library does **not** cancel by itself. Call `ref.current?.cancel()` to discard the recording, or do something else, such as asking for confirmation.

**On `onSlideLock`:** the library changes nothing; recording simply continues. Show your own locked UI, for example a stop button and a "locked" badge. Nothing else is needed to keep recording after the finger lifts, because the recorder does not stop when the touch ends.

**Hints:** the view does not draw a "slide to cancel" label or a lock icon. Use `onSlideProgress` to animate your own, for example fading a label as `cancelProgress` grows.

## Hold to record {#hold-to-record}

The built-in gestures only track a touch that **starts on the recorder view after recording has begun**. A finger that is already down when `start()` is called, for example on a press-and-hold record button, is not picked up, even if the recorder appears under it.

For a press-and-hold flow, track the drag on your own record button (with `PanResponder` or `react-native-gesture-handler`), call `start()` on press, `cancel()` when the finger has moved far enough to the left, and keep recording or `stop()` on release as your design requires. The built-in gestures fit the flow where the user taps record first and then drags on the recorder.

You can try both gestures with the mouse or a finger in the [browser demo](/guide/demo).
