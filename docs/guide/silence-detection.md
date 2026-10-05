---
description: "Detect a quiet stretch while recording with silenceThresholdDb and silenceTimeoutMs, react to onSilenceDetected or stop, and pick thresholds per platform."
---

# Silence detection {#silence-detection}

The recorder can tell you when the input has been quiet for a while, for example to stop a voice memo once the user stops talking.

```tsx
<WaveformRecorderView
  ref={ref}
  style={{ height: 56 }}
  silenceThresholdDb={-45}
  silenceTimeoutMs={2000}
  autoStopOnSilence
  onSilenceDetected={(e) => console.log(`Quiet for ${e.durationMs} ms`)}
  onComplete={(e) => send(e.uri, e.samples)}
/>
```

| Prop | Default | Meaning |
| --- | --- | --- |
| `silenceThresholdDb` | `-160` | Level in dBFS below which a meter reading counts as quiet. |
| `silenceTimeoutMs` | `0` | How long the input must stay quiet. `0` turns detection off. |
| `autoStopOnSilence` | `false` | Call `stop()` automatically when silence is detected. |

The defaults never fire: `-160` dBFS is below any real reading and a timeout of `0` disables the check. Set **both** the threshold and the timeout.

## How it is measured {#how-it-is-measured}

Silence detection runs on every meter tick while recording, `meterUpdatesPerSecond` times per second:

1. If the tick's `db` is at or above `silenceThresholdDb`, it counts as sound and the quiet timer resets.
2. Otherwise the quiet stretch continues. The first quiet tick after sound starts the timer.
3. Once the stretch reaches `silenceTimeoutMs`, `onSilenceDetected` fires with how long it has lasted, and with `autoStopOnSilence` the recording stops and `onComplete` fires.
4. It fires once per quiet stretch. The next tick at or above the threshold re-arms it.

Each tick is compared on its own. There is no averaging over several ticks, so a single loud tick, such as a click, resets the timer.

The timer uses wall-clock time and is not reset by `pause()`. If the user pauses in the middle of a quiet stretch, the paused time counts too, and the event can fire on the first quiet tick after `resume()`.

## Choosing a threshold {#choosing-a-threshold}

The `db` value is the same one `onMeter` reports, and it is measured differently per platform:

| Platform | What `db` is |
| --- | --- |
| iOS | Average power over the last tick (`AVAudioRecorder.averagePower`). |
| Android | Peak level over the last tick, converted to dBFS. |

Peaks are higher than averages, so the same room reads louder on Android. Start around `-45` to `-50` dBFS, log `onMeter` on a real device in a quiet room and while talking, and pick a value between the two, per platform if needed:

```tsx
silenceThresholdDb={Platform.OS === 'ios' ? -50 : -40}
```

You can also watch the numbers in the [browser demo](/guide/demo), which computes both mappings from your microphone.
