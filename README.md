# react-native-waveform-recorder

High-performance React Native audio recorder with a **native live waveform**, multi-segment record/pause/resume, in-place preview + scrub playback, and a 64-bucket export ready for chat-bubble waveforms. Built on the New Architecture (Fabric), zero JS in the metering hot path.

<div align="center">
    <img src="./demo.png" alt="Demo screenshot" width="600" />
</div>

**Best paired with [`react-native-waveform-player`](https://github.com/maitrungduc1410/react-native-waveform-player)** — this library handles the recording side; the player handles playback. Use them together for a complete voice-message stack: record with a live waveform, then drop the resulting URI + 64-bucket peaks straight into the player for the chat bubble — no decode round-trip needed. Both libraries are intentionally standalone (zero shared peer deps) and share the same visual language.

**Works with Expo** — fully supported via a [development build](https://docs.expo.dev/develop/development-builds/introduction/) (EAS Build or `expo prebuild`). Doesn't work in Expo Go because Expo Go can't load third-party native modules. See [Expo install](#expo) below.

## Demo

| iOS | Android |
| :---: | :---: |
| <video src="https://github.com/user-attachments/assets/683227e2-3f87-4b31-b4ce-7c3a43aae9c6" controls loop muted></video> |<video src="https://github.com/user-attachments/assets/6e84d929-5fe0-4198-8379-6c4a3b73b3e4" controls loop muted></video> |

## Why another recorder?

| | this library | [`@simform_solutions/react-native-audio-waveform`](https://github.com/SimformSolutionsPvtLtd/react-native-audio-waveform) | [`react-native-nitro-sound`](https://github.com/hyochan/react-native-nitro-sound) | [`@lodev09/expo-recorder`](https://github.com/lodev09/expo-recorder) | [`@bhojaniasgar/react-native-audio-waveform`](https://github.com/bhojaniasgar/react-native-audio-waveform) |
| --- | --- | --- | --- | --- | --- |
| Renders waveform | **Native, on-thread** (Swift / Kotlin) | Native (`mode="live"` for recording, `mode="static"` for playback) | **No built-in renderer** — exposes `currentMetering`, you draw it yourself | JS-driven via Reanimated | Native |
| Live waveform during recording | **Yes** | Yes | Manual (from metering callback) | Yes | Yes |
| Record + pause/resume → same file | **Yes** | Yes (`pauseRecord` / `resumeRecord`) | Yes (`pauseRecorder` / `resumeRecorder`) | Via underlying `expo-audio` | Yes (`pauseRecording` / `resumeRecording`, Android 7.0+) |
| Preview state (in-place playback + scrub) | **Yes** | Separate `static` mode pointing at the file | No integrated preview UI | Manual (composed externally) | Separate `Waveform` component for playback |
| WhatsApp-style 64-bucket export | **Built in** (`onComplete.samples`) | No | No | No | No |
| Slide-to-cancel / slide-to-lock | **Native gestures** | No | No | No | No |
| Silence detection w/ auto-stop | **Yes** | No | No | No | No |
| Output formats | `m4a`, `aac`, `wav`, `opus` | Configurable encoder (AAC/AAC-LD/HE-AAC/…) | Configurable via `AudioSet` (AAC/AAC-LD/…) | Whatever `expo-audio` supports | m4a (default) |
| Raw-PCM streaming hook | **Opt-in subpath** (`/pcm-stream`) | No | No (metering only) | No | No |
| Dependencies | **None** | `react-native-gesture-handler` | `react-native-nitro-modules` | `expo-audio` + `react-native-reanimated` + `react-native-gesture-handler` | None |
| Ecosystem | Bare RN **+ Expo** (dev client) | Bare React Native | Bare React Native | **Expo-only** | Bare React Native |

## Install

```sh
npm install react-native-waveform-recorder
# or
yarn add react-native-waveform-recorder
```

Requires React Native **0.85+** with the **New Architecture enabled** (Fabric + TurboModules). Bare minimums: iOS 13, Android API 24 (Android API 29 for opus output).

### iOS

```shell
pod install
```

Add a microphone usage description to `Info.plist`:

```xml
<key>NSMicrophoneUsageDescription</key>
<string>Record voice messages.</string>
```

If you opt into `backgroundRecording`, also add:

```xml
<key>UIBackgroundModes</key>
<array>
  <string>audio</string>
</array>
```

### Android

The library declares `RECORD_AUDIO` for you. You still need to request the runtime permission from JS — the wrapper does this automatically on `start()` via `PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO)`.

For `backgroundRecording`, declare the foreground service in your `android/app/src/main/AndroidManifest.xml`:

```xml
<service
    android:name="com.waveformrecorder.WaveformRecorderBackgroundService"
    android:foregroundServiceType="microphone"
    android:exported="false" />
```

`FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_MICROPHONE` are already declared by the library and merged in for you.

### Expo

This library works with Expo via a **[development build](https://docs.expo.dev/develop/development-builds/introduction/)** (EAS Build or `npx expo prebuild`). It does **not** work in Expo Go — Expo Go can't load third-party native modules.

**1. Install the package.**

```sh
npx expo install react-native-waveform-recorder
```

**2. Add the config plugin to `app.json` / `app.config.js`.**

The library ships an Expo config plugin that wires up the native permissions and the Android foreground service for you — no manual `Info.plist` / `AndroidManifest.xml` edits.

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-waveform-recorder",
        {
          "microphonePermission": "Allow $(PRODUCT_NAME) to record voice messages.",
          "backgroundRecording": false
        }
      ]
    ]
  }
}
```

Both options are optional:

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `microphonePermission` | `string \| false` | generic message | Sets iOS `NSMicrophoneUsageDescription`. Pass `false` to leave it untouched (e.g. if you set it elsewhere). |
| `backgroundRecording` | `boolean` | `false` | When `true`, adds the iOS `audio` `UIBackgroundMode` **and** the Android foreground `<service>` declaration so the `backgroundRecording` prop works. |

If you don't need background recording you can add the plugin with no options at all:

```json
{
  "expo": {
    "plugins": ["react-native-waveform-recorder"]
  }
}
```

The library auto-merges `RECORD_AUDIO` + foreground-service permissions into the Android manifest via manifest-merger, so you don't need to list them in `android.permissions`.

**3. Generate the native projects (or rebuild your dev client).**

```sh
npx expo prebuild --clean
# then re-build your dev client / EAS Build
eas build --profile development --platform all
```

The library's `WaveformRecorder.podspec` uses standard new-architecture autolinking (`install_modules_dependencies(s)`), so `expo prebuild` picks it up automatically — no manual `Podfile` or `build.gradle` edits required.

**SDK compatibility.** The library requires React Native 0.85+ with the New Architecture enabled. Pick an Expo SDK that ships RN 0.85 or newer (check the [Expo SDK ↔ RN compatibility table](https://docs.expo.dev/versions/latest/)). New Architecture is the default on recent Expo SDKs; if you're on an older one, enable it with `"newArchEnabled": true` in `app.json`.

## Quick start

```tsx
import { useRef } from 'react';
import { Button, View } from 'react-native';
import {
  WaveformRecorderView,
  type WaveformRecorderViewRef,
} from 'react-native-waveform-recorder';

export function VoiceNote() {
  const ref = useRef<WaveformRecorderViewRef>(null);
  return (
    <View>
      <WaveformRecorderView
        ref={ref}
        style={{ height: 56 }}
        playedBarColor="#25D366"
        onComplete={(e) => {
          console.log('saved:', e.uri, e.durationMs, e.samples.length);
        }}
      />
      <Button title="Record" onPress={() => ref.current?.start()} />
      <Button title="Stop" onPress={() => ref.current?.stop()} />
    </View>
  );
}
```

`onComplete.samples` is a 64-bucket `number[]` in `[0, 1]` computed natively post-recording — drop it straight into a chat-bubble waveform without re-decoding the file.

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

| state | what's happening |
| --- | --- |
| `idle` | view rendered, nothing recorded yet |
| `recording` | meter + bars live, writing to disk |
| `paused` | meter paused, file flushed but not finalized |
| `preview` | playback-style view with scrub gesture + play button |
| `betweenSegments` | post-preview, ready to `resume()` and append a new segment |
| `stopped` | terminal state; segments concatenated, `onComplete` fired |

`controlledState` flips the component into a controlled mode where you advance state via prop updates and commands become inert.

## Props

### Recording config

| prop | type | default | notes |
| --- | --- | --- | --- |
| `outputUri` | `string` | _cache dir_ | Where to write the final file. The host's cache dir is used if omitted. |
| `output` | `{ format, sampleRate, channels, bitrate, quality }` | `m4a / 44.1k / 1ch / 128kbps / high` | Convenience nested form. Equivalent to individual `outputFormat`, `outputSampleRate`, `outputChannels`, `outputBitrate`, `outputQuality` props. |
| `outputFormat` | `'m4a' \| 'aac' \| 'wav' \| 'opus'` | `'m4a'` | Opus requires iOS 11+ / Android API 29+; older OSes silently fall back to AAC. Container extension follows the format. |
| `outputSampleRate` | `number` | `44100` | |
| `outputChannels` | `1 \| 2` | `1` | |
| `outputBitrate` | `number` | `128000` | Ignored for `wav` (lossless). |
| `outputQuality` | `'low' \| 'medium' \| 'high'` | `'high'` | |
| `maxDurationMs` | `number` | `0` | `0` = no cap. When hit, `onMaxDurationReached` fires + recording auto-stops. |
| `minDurationMs` | `number` | `0` | Soft hint surfaced via `onComplete.durationMs` (useful for "press-and-hold" UIs). |
| `meterUpdatesPerSecond` | `number` | `30` | Native polling rate for the meter (iOS `CADisplayLink`, Android `Handler`). |
| `samplesPerSecond` | `number` | `12` | Visual sample rate — how many bars/sec we paint on screen. |

### Visual

| prop | type | default |
| --- | --- | --- |
| `playedBarColor` / `unplayedBarColor` / `futureBarColor` | `ColorValue` | _system blue_ / `#3a3a3a` / `unplayedBarColor` |
| `barWidth` / `barGap` / `barRadius` | `number` | `3` / `2` / `barWidth/2` |
| `containerBackgroundColor` / `containerBorderRadius` / `showBackground` | `ColorValue` / `number` / `boolean` | `transparent` / `16` / `true` |
| `showTime` / `timeColor` / `timeMode` | `boolean` / `ColorValue` / `'count-up' \| 'count-down'` | `true` / `#fff` / `'count-up'` |
| `recordingMode` | `'scroll' \| 'morph' \| 'centered'` | `'scroll'` | How new bars enter — feed from the right (`scroll`), grow in place (`morph`), centered around a playhead. |
| `futureBarStyle` | `'dot' \| 'line' \| 'hidden'` | `'hidden'` | What to render in the un-recorded portion. Default matches WhatsApp / Slack / Messenger (nothing until the first sample arrives). Set to `'dot'` or `'line'` for an Instagram / Zalo-style placeholder. |
| `newSampleEntry` | `'grow' \| 'fade' \| 'none'` | `'grow'` | Per-bar entry animation. |

### Preview & continue-recording

| prop | type | default | notes |
| --- | --- | --- | --- |
| `enablePreview` | `boolean` | `true` | Gates `enterPreview` command. |
| `enableContinueRecording` | `boolean` | `true` | Gates `resume()` from preview (WhatsApp-style multi-segment). |
| `showPlayButton` / `playButtonColor` | `boolean` / `ColorValue` | `true` / `playedBarColor` | Built-in play/pause button shown during preview state. |

### Gestures

| prop | type | default |
| --- | --- | --- |
| `enableSlideToCancel` / `slideToCancelThresholdDp` | `boolean` / `number` | `false` / `80` |
| `enableSlideToLock` / `slideToLockThresholdDp` | `boolean` / `number` | `false` / `80` |

### Silence detection

| prop | type | default | notes |
| --- | --- | --- | --- |
| `silenceThresholdDb` | `number` | `-160` | Negative dBFS. `-50` is a typical "room is quiet" threshold. |
| `silenceTimeoutMs` | `number` | `0` | `0` disables. |
| `autoStopOnSilence` | `boolean` | `false` | When true, the engine calls `stop()` itself after a silence window. |

### Background recording

| prop | type | default | notes |
| --- | --- | --- | --- |
| `backgroundRecording` | `boolean` | `false` | Requires plist + manifest setup (see [Install](#install)). On iOS we emit `onError('background-capability', …)` once if `audio` is missing from `UIBackgroundModes`. |
| `backgroundNotificationTitle` / `backgroundNotificationBody` | `string` | _generic_ | Android-only: shown in the foreground-service notification. |

### Raw PCM streaming

| prop | type | default | notes |
| --- | --- | --- | --- |
| `enablePcmStream` | `boolean` | `false` | WAV-only. Stream raw PCM via `onPcmChunk` — see the [Raw PCM streaming](#raw-pcm-streaming) section below for the full guide. |
| `pcmChunkMs` | `number` | `200` | Target chunk cadence in ms. |

### Controlled state

| prop | type | default | notes |
| --- | --- | --- | --- |
| `controlledState` | `'auto' \| 'idle' \| 'recording' \| 'paused' \| 'preview' \| 'stopped'` | `'auto'` | Switch to controlled mode where the host advances state via prop updates and commands become inert (they still emit `onStateChange` with the *requested* new state). |

## Events

| event | payload | when |
| --- | --- | --- |
| `onStateChange` | `{ state, durationMs }` | every state transition |
| `onMeter` | `{ amplitude, peak, db }` | `meterUpdatesPerSecond` Hz while recording |
| `onMaxDurationReached` | `{}` | `maxDurationMs` reached |
| `onComplete` | `{ uri, durationMs, format, mimeType, sizeBytes, sampleRate, channels, samples (64-bucket number[]), peakAmplitude }` | after `stop()` finalises |
| `onError` | `{ message, code }` | non-fatal warnings + fatal failures (code namespaced per origin: `session`, `start`, `pcm-stream`, …) |
| `onPermissionDenied` | `{}` | mic permission denied at `start()` |
| `onSeek` | `{ positionMs }` | scrub gesture or `seekPreview()` |
| `onPlaybackTimeUpdate` | `{ positionMs, durationMs }` | preview playback tick |
| `onSlideProgress` | `{ cancelProgress, lockProgress }` _(each 0-1)_ | live during slide gesture |
| `onSlideCancel` / `onSlideLock` | `{}` | once when the gesture threshold is crossed |
| `onSilenceDetected` | `{ durationMs }` | once per silence window |
| `onPcmChunk` | `{ chunk (base64), sampleRate, channels, bytesPerSample, timestampMs }` | every `pcmChunkMs` while `enablePcmStream + outputFormat='wav'` |

## Imperative commands

Hold a `ref` to the view and call methods directly.

| command | notes |
| --- | --- |
| `start()` | Begins (or restarts) recording. Auto-requests mic permission. |
| `pause()` | Pauses the active segment without finalising it. |
| `resume()` | Resumes from `paused` (same segment) or `betweenSegments` (new segment). |
| `stop()` | Finalises, concatenates segments, fires `onComplete`. |
| `cancel()` | Discards all segments + returns to `idle`. Does not fire `onComplete`. |
| `enterPreview()` / `exitPreview()` | Switch into / out of the preview state. |
| `togglePreviewPlayback()` | Play / pause preview audio. |
| `seekPreview(positionMs)` | Seek the preview playhead. |

## Raw PCM streaming

The default bundle stays small — raw PCM lives behind an opt-in subpath so apps that don't need it never pay the cost.

```tsx
import { WaveformRecorderView } from 'react-native-waveform-recorder';
import {
  decodePcmChunk,
  pcmToMonoFloat32,
} from 'react-native-waveform-recorder/pcm-stream';

<WaveformRecorderView
  output={{ format: 'wav', sampleRate: 16000, channels: 1 }}
  enablePcmStream
  pcmChunkMs={100}
  onPcmChunk={(e) => {
    const int16 = decodePcmChunk(e.chunk);
    const f32 = pcmToMonoFloat32(int16, e.channels);
    // hand `f32` to your STT / VAD pipeline of choice
  }}
/>;
```

Caveats:

- Only works with `outputFormat = 'wav'` — m4a / opus paths don't expose pre-encoded samples.
- Payloads cross the bridge as base64, **not zero-copy buffers**. Fine up to ~1 MB/s; beyond that prefer a true JSI module like [`react-native-audio-api`](https://github.com/software-mansion/react-native-audio-api).

## Recipes

The `example/` workspace ships themed, copy-pastable recipes that mirror real-world voice-message UIs. **All six chat-style recipes pair this library with [`react-native-waveform-player`](https://github.com/maitrungduc1410/react-native-waveform-player)** — `onComplete` hands the player both the recorded file URI and the 64-bucket peaks, so the playback bubble paints instantly with no decode round-trip. See `example/src/components/SentVoiceNote.tsx` for the shared bubble.

| recipe | location | what it shows |
| --- | --- | --- |
| **WhatsApp** | `example/src/screens/WhatsAppScreen.tsx` | green pill, mic-as-send swap, swipe-up-to-lock + slide-left-to-cancel chevron, preview with delete + send. Sent voice notes become playable "out" bubbles in the chat thread. |
| **Messenger** | `example/src/screens/MessengerScreen.tsx` | continue-recording flow, gradient pill, locked vs unlocked variants. Sent notes appear as playable bubbles in the conversation feed. |
| **Instagram** | `example/src/screens/InstagramScreen.tsx` | gradient ring meter + bottom-sheet preview. Sent notes appear as right-aligned DM player bubbles. |
| **Slack** | `example/src/screens/SlackScreen.tsx` | single-press send, no preview. Sent notes appear as `#general` voice-memo messages. |
| **TikTok** | `example/src/screens/TikTokScreen.tsx` | hold-to-record, no preview, dark theme. Sent notes appear in a "Recent sends" reel. |
| **Zalo** | `example/src/screens/ZaloScreen.tsx` | light-mode pill with explicit delete / preview / send action row. Sent notes appear as light-mode player bubbles. |
| **Gesture playground** | `example/src/screens/GestureScreen.tsx` | live cancel/lock progress bars driven by `onSlideProgress`. |
| **Silence demo** | `example/src/screens/SilenceScreen.tsx` | adjustable threshold + auto-stop on silence. |
| **64-sample export** | `example/src/screens/SamplesExportScreen.tsx` | renders `onComplete.samples` three ways for chat-bubble parity. |
| **Stress test** | `example/src/screens/StressTestScreen.tsx` | 30-minute run with tick / peak / RMS counters. |
| **Raw PCM stream** | `example/src/screens/PcmStreamScreen.tsx` | end-to-end VAD-style consumer of `onPcmChunk`. |

Run the example app:

```sh
yarn install
cd example
yarn ios   # or yarn android
```

## How it works

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full breakdown — file layout, state machine, threading model, memory bounds, codegen quirks, drawing pipeline, Fabric lifecycle, and segment concat strategies per format.

In short: the JS layer is intentionally thin (permission flow + ref shape + DirectEvent re-emission). Everything else — recording, drawing, metering, scrub gestures, preview playback, multi-segment concat — lives in Swift / Kotlin behind a Fabric composite view.

## Lessons learned

If you're building something similar (a native-rendering Fabric component, an audio recorder, a stateful UI with async lifecycle) — or you're picking this codebase up to extend it — start with [LESSONS_LEARNED.md](./LESSONS_LEARNED.md). It's the field report of every non-obvious bug we hit (Fabric quirks like `display: 'none'` unmounting iOS views, async race conditions in preview snapshots, the WAV multi-segment memory bomb, state-machine UI desync patterns, …) along with the meta-lessons each one taught us. Cheaper to read than to re-discover.

## Roadmap & known limitations

The library is feature-complete and production-ready, but a few items are deferred for future releases. PRs welcome.

### Planned improvements

- **`recordingMode` modes `morph` and `centered`** — currently only `'scroll'` is fully implemented. `'morph'` (grow new bars in place, no scrolling) and `'centered'` (playhead-anchored layout with bars expanding outward) are accepted as prop values but fall back to `'scroll'`. Implementing them needs new sub-pixel slot math in `WaveformBarsView` on both platforms — the scroll math doesn't translate directly because it assumes new samples always enter from the right edge.
- **Streaming WAV multi-segment concat** — the only known long-recording memory hazard. When the user pauses + resumes a `wav`-format recording multiple times then calls `stop()` or `enterPreview()`, the current concat path buffers every segment's PCM in RAM before writing the output. Peak memory ~1× total PCM on Android, ~3× on iOS. For a 1-hour multi-segment WAV at 44.1 kHz mono 16-bit (~317 MB raw), iOS can peak ~950 MB and crash. The fix is straightforward — replace the buffer-then-write path with a chunked-stream-then-write path (~256 KB peak instead of 3× PCM) on both platforms. Continuous (no-pause) WAV recordings and any-length recordings in `m4a`/`aac`/`opus` are unaffected.
- **CI workflow** — `lint` / `typecheck` / iOS build / Android build pipeline. Currently runs locally only.
- **npm publish** — first publish to npm is still pending; install from the GitHub repo until then.
- **True zero-copy PCM streaming** — current `onPcmChunk` payloads cross the bridge as base64. Fine up to ~1 MB/s. For higher throughput a JSI-backed buffer module (or delegating to [`react-native-audio-api`](https://github.com/software-mansion/react-native-audio-api)) would avoid the base64 round-trip.

### Out of scope

These were intentionally rejected during planning to keep the library focused:

- Streaming uploads from the recorder — handle in your own code on `onComplete`.
- Multi-track mixing.
- Recording effects / filters / VST-style processing — use `react-native-audio-api` if you need this.
- JS-side custom waveform renderers — the native renderer is the whole point.
- Old React Native architecture (paper-only) support.

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

## License

MIT
