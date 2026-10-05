---
description: "The ref methods of WaveformRecorderView, from start, pause and stop to cancel, enterPreview and seekPreview, and the states in which each one acts."
---

# Ref methods {#ref-methods}

Drive the recorder through a ref typed as `WaveformRecorderViewRef`:

```tsx
const ref = useRef<WaveformRecorderViewRef>(null);

<WaveformRecorderView ref={ref} style={{ height: 56 }} />;

ref.current?.start();
```

Methods return nothing. Watch `onStateChange` to know what happened. A call that does not apply to the current state is ignored, except the cases that report an [`onError` code](/guide/events#error-codes).

| Method | Acts in | What it does |
| --- | --- | --- |
| `start()` | `idle`, `stopped`, `error`, `paused` | Requests microphone permission, then starts a new recording. In `paused` it resumes the current one. |
| `pause()` | `recording` | Pauses. The same file continues on `resume()`. |
| `resume()` | `paused`, `preview` | From `paused`, continues the same segment. From `preview`, stops the player and records a new segment. |
| `stop()` | `recording`, `paused`, `preview` | Finalises the recording, joins segments and fires `onComplete`. |
| `cancel()` | any | Discards the session, deletes its files and returns to `idle`. |
| `enterPreview()` | `recording`, `paused` | Pauses if needed and loads everything recorded so far into the built-in player. |
| `exitPreview()` | `preview` | Leaves preview and returns to `paused`. |
| `togglePreviewPlayback()` | `preview` | Plays or pauses the preview audio. |
| `seekPreview(positionMs)` | `preview` | Moves the preview playhead and fires `onSeek`. |

## start() {#start}

On Android the JavaScript wrapper checks and requests `RECORD_AUDIO` first. On iOS the native side shows the system prompt the first time. If permission is refused, `onPermissionDenied` fires and the state does not change.

From `idle`, `stopped` or `error`, `start()` begins a fresh session. Starting again after `stop()` does not delete the previous file, but a later `cancel()` or unmount can, see [Keep the file](/guide/export#keep-the-file).

## stop() {#stop}

`stop()` returns before the file is ready. With one segment, `onComplete` fires right away. With several segments the files are joined first, then `onComplete` fires. If nothing was recorded, the state becomes `stopped` without `onComplete`.

If `minDurationMs` is set and `stop()` is called while recording or paused with less audio than that, it discards the recording instead: the files are deleted, the state returns to `idle` and `onError` fires with code `'min-duration'`.

## cancel() {#cancel}

`cancel()` stops everything and deletes the session's segment files. It also works after `stop()`, and then it can delete the file that `onComplete` delivered. Copy that file first if you need it.

## Calling methods on a hidden view {#hidden-view}

On iOS, `display: 'none'` unmounts the native view, so the ref is `null` and calls are lost, and the recording files are cleaned up. To keep a recorder mounted but invisible, move it off screen instead, for example `position: 'absolute', left: -100000`.
