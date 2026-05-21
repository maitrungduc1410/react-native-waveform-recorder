# AGENTS.md

This file is the entry point for AI coding agents working in this repo. Read it before making changes. It's deliberately short — for the full deep-dive read [ARCHITECTURE.md](./ARCHITECTURE.md), and for the user-facing surface read [README.md](./README.md).

---

## What this repo is

`react-native-waveform-recorder` — a React Native (Fabric / New Architecture) audio recorder with a native live waveform. Standalone (zero JS peer deps). Pairs with [`react-native-waveform-player`](https://github.com/maitrungduc1410/react-native-waveform-player) for the playback half of a voice-message product.

- **Languages**: TypeScript (JS surface), Swift (iOS native), Kotlin (Android native), a tiny Objective-C++ bridge (`ios/WaveformRecorderView.mm`).
- **Build target**: React Native 0.85+ with New Architecture (Fabric + TurboModules). iOS 13+, Android API 24+ (API 29+ for opus).
- **Package manager**: **Yarn 4 workspaces.** Do not use `npm`.

---

## Repo layout

```
.
├── src/                                   JS/TS public surface
│   ├── WaveformRecorderViewNativeComponent.ts   Codegen spec (source of truth)
│   ├── WaveformRecorderView.tsx                 Public types + non-native fallback
│   ├── WaveformRecorderView.native.tsx          Native wrapper (ref, permissions, CSV→array)
│   ├── pcm-stream/index.tsx                     Opt-in PCM helpers (subpath import)
│   └── index.tsx                                Public re-exports
│
├── ios/                                   Native iOS sources
│   ├── WaveformRecorderView.h / .mm             Objective-C++ Fabric bridge
│   ├── WaveformRecorderViewImpl.swift           Composite view, state machine, layout
│   ├── AudioRecorderEngine.swift                Recording engine (AVAudioRecorder/AudioRecord)
│   ├── AudioPlayerEngine.swift                  Preview playback (AVPlayer)
│   ├── WaveformBarsView.swift                   Live + preview ribbon, scrub gesture
│   ├── WaveformDecoder.swift                    64-bucket downsampler
│   └── PlayPauseButton.swift                    Preview-only play/pause control
│
├── android/src/main/java/com/waveformrecorder/   Native Android sources
│   ├── WaveformRecorderPackage.kt
│   ├── WaveformRecorderViewManager.kt           Fabric view manager
│   ├── WaveformRecorderView.kt                  Composite view (mirror of iOS impl)
│   ├── AudioRecorderEngine.kt                   Recording engine
│   ├── AudioPlayerEngine.kt                     Preview playback
│   ├── WaveformBarsView.kt                      Live + preview ribbon
│   ├── WaveformDecoder.kt                       64-bucket downsampler
│   ├── PlayPauseButton.kt                       Preview-only play/pause control
│   ├── WaveformRecorderBackgroundService.kt     Microphone foreground service
│   └── WaveformRecorderEvent.kt                 DirectEvent helpers
│
├── example/                               Comprehensive example app + recipes
│   ├── src/App.tsx                              Stack navigator entry
│   ├── src/screens/*.tsx                        Per-screen demos + recipes
│   └── src/components/*.tsx                     Shared UI (SentVoiceNote, etc.)
│
├── README.md                              User-facing docs
├── ARCHITECTURE.md                        Internals, threading, memory bounds
├── CONTRIBUTING.md                        How to set up + run + PR
└── package.json                           Library manifest + codegen config
```

When adding files, follow the existing patterns — don't introduce parallel folders.

---

## Common commands

Run from repo root unless stated otherwise.

| Command | What it does |
| --- | --- |
| `yarn` | Install deps (root + example workspace). |
| `yarn typecheck` | TypeScript check of the library + example. |
| `yarn lint` | ESLint over `**/*.{js,ts,tsx}`. |
| `yarn lint --fix` | Auto-fix lint + format. |
| `yarn example start` | Start Metro for the example app. |
| `yarn example android` | Build + install + run the example app on Android. |
| `yarn example ios` | Build + install + run the example app on iOS. |
| `yarn example build:android` | Headless Android Debug build (CI-friendly). |
| `yarn example build:ios` | Headless iOS Debug build. |
| `cd example/ios && pod install` | Regenerate iOS codegen. **Required after any change to `src/WaveformRecorderViewNativeComponent.ts`.** |
| `yarn prepare` | Compile the library with `bob` (ESM + .d.ts in `lib/`). |
| `yarn clean` | Delete `lib/`, native build dirs, example build dirs. |

---

## Mandatory conventions

### Native changes

- **iOS Swift code is bridged through `WaveformRecorderView.mm`.** When you add a prop, event, or command, change all of:
  1. `src/WaveformRecorderViewNativeComponent.ts` (codegen spec — source of truth)
  2. `src/WaveformRecorderView.tsx` (public types + JSDoc)
  3. `src/WaveformRecorderView.native.tsx` (wrapper)
  4. `ios/WaveformRecorderView.mm` (bridge entries)
  5. `ios/WaveformRecorderViewImpl.swift` (handler)
  6. `android/.../WaveformRecorderViewManager.kt` (Fabric view manager)
  7. `android/.../WaveformRecorderView.kt` (handler)
  8. Re-run `cd example/ios && pod install` so iOS codegen picks up the change. Android regenerates as part of gradle.
- **Keep iOS and Android in lockstep.** When you fix a bug on one platform, fix or audit the same code path on the other. The two composite views (`WaveformRecorderViewImpl.swift` / `WaveformRecorderView.kt`) are intentional mirrors.
- **Codegen DirectEvent payloads cannot contain arrays.** If you need to emit an array, serialise to a delimited string on the native side and parse it in `WaveformRecorderView.native.tsx` (existing precedent: `samplesCsv` → `samples: number[]`).

### Threading

- Touch UI views only from the main thread. Hop with `DispatchQueue.main.async` (iOS) / `mainHandler.post` (Android) when emitting events from background queues.
- Long work (concat, decode, file I/O) must run off the main thread.
- When you start a timer / display link / handler runnable, ensure it is cancelled in **every** state exit path (`pause`, `stop`, `cancel`, `tearDown`, `deinit` / `onDropViewInstance`).

### Memory

- Don't introduce indefinitely growing in-memory buffers. Reference [ARCHITECTURE.md#memory-bounds](./ARCHITECTURE.md#memory-bounds) for the current caps. If you need a new buffer, cap it with stride-merging or a ring strategy.
- If you load file data into RAM, ensure peak usage is bounded by a configurable chunk size, not the file size.

### Style

- Don't add narrative comments that just paraphrase the code. Comments should explain non-obvious *why* — trade-offs, native-API quirks, race-condition guards. The existing native files are heavily commented in this style; match it.
- Match the existing import order, naming, and formatting. Run `yarn lint --fix` before finishing.
- Prefer editing existing files over creating new ones. The repo intentionally keeps the file count small.

### Testing

- There are no automated tests yet. Manual verification path:
  1. `yarn typecheck && yarn lint`
  2. `yarn example android` — exercise the changed screens
  3. `yarn example ios` — exercise the same screens
  4. For state-machine / concat / long-recording work, run the **`StressTestScreen`** for at least one full minute.
- Add tests only if the user explicitly asks.

---

## Gotchas (real bugs we've already hit)

These bit us during development. If your change touches a related area, double-check it didn't regress:

| Symptom | Root cause | Fix pattern |
| --- | --- | --- |
| iOS recipe screen's record button does nothing while Android works | `display: 'none'` on a parent `View` unmounts the Fabric host view on iOS, nulling the imperative ref | Use absolute off-screen positioning (`position: 'absolute', left: -100000`) when you need a recorder mounted but hidden |
| Play button missing on Android in preview mode | Initial `View.GONE` prevents layout measurement; later `setVisibility(VISIBLE)` leaves it at 0×0 | Use `View.INVISIBLE` for the initial state and force `measure()`/`layout()` after visibility changes |
| iOS scrub conflicts with React Navigation swipe-back | Raw `touchesBegan/Moved/…` don't claim gesture priority | Use `UILongPressGestureRecognizer` with `minimumPressDuration = 0`, `allowableMovement = .greatestFiniteMagnitude`, `cancelsTouchesInView = false` |
| Waveform disappears after `record → pause → enterPreview → exitPreview` | `barsView.isRecording = true` setter clears the ring buffer (assumes a fresh session) | After re-arming `isRecording = true`, re-seed `recordingAmps` from the engine's `amplitudeHistorySnapshot` |
| Stale snapshot callback re-enters preview after user cancelled | Async `snapshotForPreview` callback had no liveness guard | Use the existing `previewToken` generation counter — bail when the token has advanced, and delete the orphaned temp file |
| `futureBarStyle: 'line'` looks identical to `'dot'` | `barWidth × barWidth` rounded rect with `cornerRadius = barWidth/2` is just a circle | Make `line` a tall vertical pill (`barWidth × barWidth*4`) |
| `Codegen` errors `Unable to determine event type for "samples": ReadonlyArray` | DirectEvent payloads can't contain arrays | Serialise to a delimited string + parse in the JS wrapper |
| iOS build fails with `no member named 'foo' in WaveformRecorderViewProps` after adding a prop | Codegen output is stale | `cd example/ios && pod install` |

---

## When in doubt

1. **Read the existing comments.** Native files (`ios/WaveformRecorderViewImpl.swift`, `android/.../WaveformRecorderView.kt`, `ios/AudioRecorderEngine.swift`, `android/.../AudioRecorderEngine.kt`) carry a lot of "do not change this because X" context. Don't ignore it.
2. **Mirror the other platform.** If the iOS code does it a certain way and the Android code doesn't, one of them is probably wrong or out of date — flag it.
3. **Don't add JS in the metering hot path.** Bars are drawn natively for a reason — keep it that way.
4. **Don't introduce a JS peer dep.** Zero-deps is a hard constraint of this library; using reanimated / svg / gesture-handler / vector-icons in the library code is a rejection-worthy change.
