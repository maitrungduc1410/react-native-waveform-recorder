---
description: "How pause, resume, preview and continue recording work in react-native-waveform-recorder, how segments are joined, and where the recording files are written."
---

# Segments, pause and preview {#segments}

A recording session can be paused, listened back to and continued before it is finished. This page explains the states, when a new segment starts and what ends up on disk.

## States {#states}

```
idle ──start()──▶ recording ──stop()──▶ stopped ──▶ onComplete
                   │     ▲
           pause() │     │ resume() / start()
                   ▼     │
                  paused ──────stop()──────▶ stopped
                   │  ▲
    enterPreview() │  │ exitPreview()
                   ▼  │
                  preview ──resume()──▶ recording (new segment)
                     └──────stop()──────▶ stopped
```

`enterPreview()` also works from `recording`; it pauses first. `cancel()` returns to `idle` from any state. `'error'` is reported when the recorder fails to start or resume.

| State | What is happening |
| --- | --- |
| `idle` | Nothing recorded yet, or the session was cancelled. |
| `recording` | The microphone is live, bars are drawn and `onMeter` fires. |
| `paused` | Recording is paused. Also reported after `exitPreview()`. |
| `preview` | The recording so far is loaded into the built-in player. |
| `stopped` | The file is final and `onComplete` has fired. |
| `error` | Starting or resuming failed. `onError` has the details. |

## Pause and resume {#pause-and-resume}

`pause()` and `resume()` keep writing to the **same file** on both platforms. The timer and `durationMs` skip the paused time. While paused, the bars stay where they are.

## Preview {#preview}

`enterPreview()` closes the current segment and loads everything recorded so far into the built-in player. The view then shows a play button (unless `showPlayButton={false}`), the bars of the whole recording squeezed to the view width, and the playback position in the timer.

- Tap the play button or call `togglePreviewPlayback()` to play or pause.
- Drag on the bars to seek. `onSeek` fires when the drag ends.
- `seekPreview(positionMs)` seeks from code.
- `onPlaybackTimeUpdate` fires about 30 times per second while audio plays.

On iOS the scrub uses a gesture recognizer that wins over a React Navigation swipe-back gesture. On Android the view asks its parent not to intercept the touch while scrubbing.

If nothing has been recorded yet, `enterPreview()` fires `onError` with code `'preview-snapshot'`. With `enablePreview={false}` it fires `'preview-disabled'`.

## Continue recording {#continue-recording}

From preview you have three ways out:

| Call | Result |
| --- | --- |
| `resume()` | Stops the player and starts recording a **new segment**. The bars continue from where the recording ended. |
| `exitPreview()` | Returns to `paused`. The next `resume()` or `start()` also starts a new segment. |
| `stop()` | Finishes the recording without recording more. |

With `enableContinueRecording={false}`, `resume()` in preview fires `onError` with code `'continue-disabled'` and nothing changes. `exitPreview()` and `stop()` still work.

## Joining segments {#joining-segments}

On `stop()`, a recording with several segments is joined into one file before `onComplete` fires:

| Format | iOS | Android |
| --- | --- | --- |
| `wav` | PCM data appended, new header written | PCM data appended, new header written |
| `m4a`, `aac` | `AVAssetExportSession`, Apple M4A preset | `MediaMuxer`, no re-encoding |
| `opus` | `AVAssetExportSession`, passthrough | `MediaMuxer`, no re-encoding |

If joining fails, `onError` fires with code `'concat'` and `onComplete` still fires with the first segment, so the user keeps at least part of the audio.

`wav` segments are read into memory to be joined. Very long `wav` recordings with a preview and continue step can use a lot of memory, especially on iOS. Prefer `m4a` for long recordings.

## Where files go {#where-files-go}

| Recording | File |
| --- | --- |
| One segment (no preview and continue) | `output.uri` if you set it, otherwise a new `wfr_*` file in the app's cache directory. |
| Several segments | Segment 1 is written as above, later segments next to it with a `_seg2`, `_seg3`, ... suffix. The joined result is a new `wfr_concat_*` file in the cache directory, so `output.uri` is not the final file. |
| Preview of several segments | A temporary joined file in the cache directory, deleted when preview ends. |

`output.uri` must be a `file://` URI. Android also accepts a plain path, iOS does not.

Cache directories can be cleared by the system. Move the final file to a permanent location, and do it before you call `cancel()` or unmount the view, which delete the session's segment files. See [Keep the file](/guide/export#keep-the-file).
