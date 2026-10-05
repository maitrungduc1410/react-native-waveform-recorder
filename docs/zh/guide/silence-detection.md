---
description: "用 silenceThresholdDb 和 silenceTimeoutMs 检测录音中的静音，处理 onSilenceDetected 或自动停止，并按平台选择阈值。"
---

# 静音检测 {#silence-detection}

录音视图可以在输入安静一段时间后通知你，例如在用户停止说话后结束语音备忘录。

```tsx
<WaveformRecorderView
  ref={ref}
  style={{ height: 56 }}
  silenceThresholdDb={-45}
  silenceTimeoutMs={2000}
  autoStopOnSilence
  onSilenceDetected={(e) => console.log(`已安静 ${e.durationMs} ms`)}
  onComplete={(e) => send(e.uri, e.samples)}
/>
```

| 属性 | 默认值 | 含义 |
| --- | --- | --- |
| `silenceThresholdDb` | `-160` | 低于该 dBFS 值的电平读数视为安静。 |
| `silenceTimeoutMs` | `0` | 输入需要持续安静的时长。`0` 表示关闭检测。 |
| `autoStopOnSilence` | `false` | 检测到静音时自动调用 `stop()`。 |

默认值永远不会触发：`-160` dBFS 低于任何实际读数，超时为 `0` 则关闭检测。请**同时**设置阈值和超时。

## 如何测量 {#how-it-is-measured}

静音检测在录音时的每个电平采样周期运行，每秒 `meterUpdatesPerSecond` 次：

1. 如果本次读数的 `db` 大于或等于 `silenceThresholdDb`，视为有声音，静音计时重置。
2. 否则静音继续。有声音之后的第一个安静读数开始计时。
3. 静音时长达到 `silenceTimeoutMs` 时，触发 `onSilenceDetected` 并带上已安静的时长；如果设置了 `autoStopOnSilence`，录音会停止并触发 `onComplete`。
4. 每段静音只触发一次。下一个大于或等于阈值的读数会重新启用检测。

每个读数单独比较，不会对多个读数求平均，所以一次很响的读数（例如一声咔哒）就会重置计时。

计时使用真实时间，并且 `pause()` 不会重置它。如果用户在一段静音中途暂停，暂停的时间也会被计入，`resume()` 之后的第一个安静读数就可能触发事件。

## 选择阈值 {#choosing-a-threshold}

`db` 与 `onMeter` 报告的值相同，而两个平台的测量方式不同：

| 平台 | `db` 是什么 |
| --- | --- |
| iOS | 上一个周期的平均功率（`AVAudioRecorder.averagePower`）。 |
| Android | 上一个周期的峰值，换算为 dBFS。 |

峰值高于平均值，所以同一个房间在 Android 上读数更高。建议从 `-45` 到 `-50` dBFS 开始，在真机上分别于安静房间和说话时记录 `onMeter`，然后在两者之间取值，必要时按平台区分：

```tsx
silenceThresholdDb={Platform.OS === 'ios' ? -50 : -40}
```

也可以在[浏览器演示](/zh/guide/demo)中观察这些数值，它会根据你的麦克风同时计算两种映射。
