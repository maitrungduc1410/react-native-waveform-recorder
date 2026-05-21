# Architecture

This document explains how `react-native-waveform-recorder` is put together so you can extend it confidently, debug native issues, and understand the trade-offs the library has chosen.

If you just want to use the library, see the [README](./README.md). If you're an AI coding agent picking up work, also read [AGENTS.md](./AGENTS.md).

---

## High-level picture

```
┌────────────────────────────────────────────────────────────────────┐
│ JS                                                                 │
│                                                                    │
│  <WaveformRecorderView ref={ref} … />        Imperative ref        │
│           │                                          │             │
│           │ Codegen props/events                     │ Commands    │
│           ▼                                          ▼             │
│  ┌───────────────────────┐                  ┌──────────────────┐   │
│  │ WaveformRecorderView  │◀────onEvent──────│   Fabric host    │   │
│  │   .native.tsx wrapper │                  │   component      │   │
│  └───────────────────────┘                  └──────────────────┘   │
└────────────────────────────────────────────────────────────────────┘
              │                                          │
              │ DirectEvent payloads                     │ Commands
              ▼                                          ▼
┌────────────────────────────────────────────────────────────────────┐
│ Native (iOS Swift / Android Kotlin)                                │
│                                                                    │
│  WaveformRecorderViewImpl.swift  / WaveformRecorderView.kt         │
│      • Composite host view                                         │
│      • Routes commands, owns lifecycle, draws play button + time   │
│      • Holds the AudioRecorderEngine + AudioPlayerEngine           │
│      │                                                             │
│      ├──► AudioRecorderEngine  ── reads → AVAudioRecorder /        │
│      │                                    MediaRecorder /          │
│      │                                    AudioRecord (WAV path)   │
│      │                                                             │
│      ├──► WaveformBarsView     ── draws live + preview ribbons     │
│      │                                                             │
│      ├──► AudioPlayerEngine    ── preview playback (AVPlayer /     │
│      │                                              MediaPlayer)   │
│      │                                                             │
│      └──► WaveformDecoder      ── post-stop 64-bucket downsample   │
└────────────────────────────────────────────────────────────────────┘
```

The JS layer is intentionally thin — it owns permission prompts, the imperative ref shape, and DirectEvent → public-callback adaptation. The native composite view owns everything else: recording, drawing, gestures, playback, lifecycle.

---

## File layout

### JS

| File | Role |
| --- | --- |
| `src/WaveformRecorderViewNativeComponent.ts` | Codegen spec (Fabric component descriptor: props, events, commands). |
| `src/WaveformRecorderView.tsx` | Public type surface + a non-native fallback (`web` / `node`). |
| `src/WaveformRecorderView.native.tsx` | Native wrapper: ref forwarding, JS-side permission flow, event re-emission, CSV → `number[]` parsing for `onComplete.samples`. |
| `src/pcm-stream/index.tsx` | Opt-in helpers for raw PCM (`decodePcmChunk`, `pcmToMonoFloat32`). |

### iOS (`ios/`)

| File | Role |
| --- | --- |
| `WaveformRecorderView.h` / `.mm` | Objective-C++ Fabric bridge. Forwards props/commands to the Swift impl and re-emits Swift callbacks as DirectEvents. |
| `WaveformRecorderViewImpl.swift` | Composite Swift view. State machine, command routing, layout, play button + time label, scrub-gesture wiring, preview lifecycle. |
| `AudioRecorderEngine.swift` | Recording engine. Owns `AVAudioRecorder` (m4a/aac/wav/opus) + `AVAudioSession` + `CADisplayLink` metering + multi-segment management + WAV concat + raw-PCM streaming. |
| `AudioPlayerEngine.swift` | Preview playback. `AVPlayer` + a `CMTime` observer. |
| `WaveformBarsView.swift` | Custom `UIView`. Draws the live ribbon, the static preview ribbon, the scrub gesture, and the progress split. |
| `WaveformDecoder.swift` | 64-bucket downsampler used at `stop()` time. |
| `PlayPauseButton.swift` | Self-contained `UIView`-based play/pause control used only in preview state. |

### Android (`android/src/main/java/com/waveformrecorder/`)

| File | Role |
| --- | --- |
| `WaveformRecorderPackage.kt` | `ReactPackage` entry — registers the view manager. |
| `WaveformRecorderViewManager.kt` | Fabric view manager. Props/commands/event registration mirrored from the iOS `.mm` bridge. |
| `WaveformRecorderView.kt` | Composite `FrameLayout`. Mirror of the Swift impl. |
| `AudioRecorderEngine.kt` | Recording engine. `MediaRecorder` (m4a/aac/opus) + `AudioRecord` + custom WAV writer thread + multi-segment via `MediaMuxer` / WAV concat + raw-PCM streaming. |
| `AudioPlayerEngine.kt` | Preview playback (`MediaPlayer`). |
| `WaveformBarsView.kt` | Custom `View`. Draws the live + preview ribbons, scrub gesture, progress split. |
| `WaveformDecoder.kt` | 64-bucket downsampler. |
| `PlayPauseButton.kt` | Self-contained play/pause control. |
| `WaveformRecorderBackgroundService.kt` | Microphone-type foreground service. Bound only when `backgroundRecording={true}`. |
| `WaveformRecorderEvent.kt` | Codegen-friendly DirectEvent enum + typed payload helpers. |

---

## State machine

```
              start()                                   stop()
   idle ─────────────────► recording ─────────────────► stopped ──► (onComplete)
                              │   ▲                       ▲
                       pause()│   │resume()               │
                              ▼   │                       │
                            paused ────► enterPreview ────┤
                                            │             │
                                            │ resume()    │
                                            ▼             │
                                       betweenSegments ───┘
                                       (continue-record)
```

| state | what's happening | underlying native state |
| --- | --- | --- |
| `idle` | view rendered, nothing recorded | engine torn down |
| `recording` | meter + bars live, writing to disk | `AVAudioRecorder` / `MediaRecorder` / `AudioRecord` running |
| `paused` | meter paused, file flushed but not finalised | recorder paused, segment file kept open |
| `betweenSegments` | preview exited; ready for `resume()` to start a new segment | recorder torn down, segment URL kept in `segments[]` |
| `preview` | scrub-able waveform + play button | recorder torn down, `AVPlayer` / `MediaPlayer` active on the concat result |
| `stopped` | terminal; `onComplete` fired with concat result | everything torn down |
| `error` | non-fatal — `onError` fires; state machine continues | engine state preserved when possible |

`controlledState` flips the machine into a controlled mode: commands fire `onStateChange` with the **requested** new state but don't mutate internal state. The host owns the source of truth.

---

## Threading model

### iOS

| Activity | Thread |
| --- | --- |
| `AVAudioRecorder` callbacks | Internal AVF queue |
| Metering tick | `CADisplayLink` → main thread (60Hz, scaled down via `meterUpdatesPerSecond`) |
| PCM stream chunking | Dedicated `DispatchSourceTimer` on a serial queue (`com.waveformrecorder.pcmstream`) |
| `WaveformBarsView` redraws | Main thread (`setNeedsDisplay` from main) |
| Multi-segment concat | Background — `AVAssetExportSession` runs on its own queue; result is hopped back to main before firing `onComplete` |
| WAV concat | `DispatchQueue.global(qos: .userInitiated)` |
| Preview time updates | `AVPlayer.addPeriodicTimeObserver` on main queue |

### Android

| Activity | Thread |
| --- | --- |
| `MediaRecorder` callbacks | Internal AOSP thread |
| Metering tick | Main-looper `Handler` posting a `Runnable` at the configured cadence |
| WAV writer (`AudioRecord` path) | Dedicated `Thread` named `waveformrecorder-writer` |
| WAV PCM stream chunking | Same writer thread; chunks are emitted via `onPcmChunk` on the main thread via `Handler` |
| `WaveformBarsView` invalidations | Main thread (Android `View` constraint) |
| Multi-segment concat | Dedicated `Thread` named `waveformrecorder-concat`, result hopped back to main |

---

## Memory bounds

All in-memory buffers are explicitly capped so the only thing that grows over a long recording is the audio file on disk (managed by the OS recorder).

| Buffer | Cap | Behaviour |
| --- | --- | --- |
| `amplitudeHistory` (engine, full session) | **16384 samples** | Once exceeded, stride-merged in place (max-of-pairs) — preserves peak energy for the 64-bucket downsampler. |
| `recordingAmps` (visual ring) | **4096 samples** | Trim-from-front on every append. The view never needs more than `visibleBars + ENTRY_WINDOW + EXIT_WINDOW`. |
| PCM stream chunk (iOS) | **256 KB per chunk** | Read from disk → base64 → emit → discard. Never retained. |
| PCM stream chunk (Android) | `pcmChunkMs` worth, reset on emit | `ByteArrayOutputStream` reset after every flush. |
| Segments list | One entry per pause/resume cycle | Just a file URL/path — payload is on disk. |
| Display links / handlers / timers | Per state | Invalidated on every state exit (pause / stop / cancel / teardown / `deinit`). |

### Known long-recording gotcha — WAV multi-segment concat

The WAV concat path (only triggered when the user **pauses + resumes** a `wav`-format recording, then calls `stop()` or `enterPreview()`) currently loads every segment's PCM into RAM before writing the output. Peak memory ≈ 1× total PCM on Android, ≈ 3× on iOS due to `Data` concatenation churn.

For a 1-hour multi-segment WAV recording at 44.1 kHz mono 16-bit (~317 MB raw), iOS can peak ~950 MB and crash. Continuous (no-pause) WAV recordings and any-length recordings in m4a/aac/opus go through different paths and are not affected.

See the [Roadmap](./README.md#roadmap--known-limitations) for the planned fix.

---

## Recording pipeline

### Segment lifecycle

A "segment" is one contiguous file the recorder writes to without pausing. The library tracks one or more segments per session and concatenates them at the very end.

```
start()             → segment 1 begins
pause()             → segment 1 file finalised, kept on disk
resume()            → segment 2 begins
pause()             → segment 2 finalised
enterPreview()      → concat(segments) → preview file
exitPreview()       → preview teardown, segments retained
resume()            → segment 3 begins (continue recording)
stop()              → concat(segments) → final output file, onComplete
```

Single-segment recordings short-circuit the concat path entirely — both `stop()` and `enterPreview()` use the lone segment file directly.

### Concat strategies

| Format | iOS | Android |
| --- | --- | --- |
| `m4a` / `aac` | `AVMutableComposition` + `AVAssetExportSession` (streaming, codec-aware) | `MediaMuxer` + `MediaExtractor` (streaming, codec-aware) |
| `opus` | Same as m4a path | Same as m4a path |
| `wav` | Custom PCM splice: read each segment, strip 44-byte header, write canonical header at the front | Same shape; currently loads all PCM in RAM (see above gotcha) |

### Preview path

`enterPreview()` triggers `snapshotForPreview()`:

1. If `segments.count == 1` — pass the segment URL straight to the player. No concat.
2. Otherwise — kick off async concat on a background thread.

The async path uses a **generation counter (`previewToken`)** to guard against stale callbacks. If any state-mutating command (`cancel`, `stop`, `resume`, `exitPreview`, …) lands while a snapshot is in flight, the in-flight callback bails and deletes any temp file it produced. This prevents:

- State desync (snapshot finishes "after" you've left preview and silently re-enters it).
- Temp file leaks from interrupted concats.

`exitPreview` re-seeds the `WaveformBarsView`'s ring buffer with the engine's amplitude history snapshot so the live ribbon remains visible after leaving preview (the `isRecording = true` setter would otherwise clear it for a fresh session).

---

## Drawing pipeline

`WaveformBarsView` has three render paths, selected per-frame from current state:

| State | What's drawn |
| --- | --- |
| `idle` (no amps) | Nothing — completely transparent. |
| `recording` or "frozen after stop" | The live ribbon: bars enter from the right with a 4-bar grow-in window, scroll smoothly leftward, then fade out over a 4-bar exit window. Optional future-bar placeholders fill any unrecorded slots. |
| `preview` | Static ribbon laid out from the left, split by `progressFraction` into played / unplayed colours, plus a scrub gesture recogniser. |

The grow-in / scroll / fade-out is driven natively by sub-pixel slot math (a `step` value computed from `samplesPerSecond` × elapsed time since the last `appendAmplitude`). There is no JS animation involvement. The newest bar is pinned to slot 0 and only grows; older bars ease leftward in sub-pixel increments. This means metering events arriving at e.g. 30 Hz still feel like a smooth 60 Hz UI because the scroll progress is computed from real time, not event count.

### Scrub gesture

iOS uses a `UILongPressGestureRecognizer` configured with `minimumPressDuration = 0`, `allowableMovement = .greatestFiniteMagnitude`, `cancelsTouchesInView = false`. This claims the touch immediately and prevents parent gestures (notably React Navigation's swipe-back) from intercepting. The gesture only attaches in preview state — `point(inside:with:)` returns `false` while recording so touches pass through.

Android uses a custom `onTouchEvent` that hands the touch back to the parent for non-scrub paths. Same gating: live recording state ignores touches.

---

## Codegen quirks worth knowing

- **DirectEvent payloads can't contain arrays.** The 64-bucket `samples` is serialised as a CSV string (`samplesCsv`) on the native side and parsed back to `number[]` in the JS wrapper before invoking the public `onComplete`. Don't rely on `samplesCsv` directly — it's an implementation detail.
- **Codegen needs to be regenerated on iOS** whenever a prop/event/command shape changes — re-run `pod install` in `example/ios`. Android regenerates as part of the gradle build automatically.
- **Defaults in the codegen spec** (`CodegenTypes.WithDefault<…, default>`) are the source of truth for the native default. Match them in the TypeScript public surface as JSDoc; don't redeclare them as JS-side `defaultProps`.

---

## Fabric view lifecycle on both platforms

- **iOS** — Fabric host views are recycled. `prepareForRecycle` is the equivalent of "reset to mounted-but-fresh"; we reset state but don't tear down the engine here (engine cleanup happens in `removeFromSuperview` / `deinit`).
- **Android** — `onDropViewInstance` is called by the view manager when the view leaves the tree. We call `tearDown()` here, which cancels the recorder, deletes any in-flight segment files, and removes pending `Handler` callbacks.

`display: 'none'` on a Fabric host view on iOS **unmounts** the underlying `UIView`, nulls the imperative ref, and silently drops commands. The example recipes use absolute off-screen positioning instead (`position: 'absolute', left: -100000`) when they need the recorder mounted but not visible.

---

## Pairing with the player

The library is **standalone** (zero JS peer deps), but it's intentionally designed to drop in next to [`react-native-waveform-player`](https://github.com/maitrungduc1410/react-native-waveform-player). They share visual primitives (bar layout, colour props, container styling) and the 64-bucket export from `onComplete.samples` is a direct input to the player — no decode round-trip needed.

The example app's recipe screens (`WhatsApp`, `Messenger`, `Instagram`, `Slack`, `TikTok`, `Zalo`) all demonstrate the recorder → player handoff via `example/src/components/SentVoiceNote.tsx`.
