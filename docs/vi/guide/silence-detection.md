---
description: "Phát hiện khoảng lặng khi ghi âm bằng silenceThresholdDb và silenceTimeoutMs, xử lý onSilenceDetected hoặc tự động dừng, và chọn ngưỡng cho từng nền tảng."
---

# Phát hiện khoảng lặng {#silence-detection}

View ghi âm có thể báo cho bạn khi âm thanh đầu vào đã im lặng một lúc, chẳng hạn để dừng ghi chú thoại khi người dùng thôi nói.

```tsx
<WaveformRecorderView
  ref={ref}
  style={{ height: 56 }}
  silenceThresholdDb={-45}
  silenceTimeoutMs={2000}
  autoStopOnSilence
  onSilenceDetected={(e) => console.log(`Im lặng ${e.durationMs} ms`)}
  onComplete={(e) => send(e.uri, e.samples)}
/>
```

| Prop | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `silenceThresholdDb` | `-160` | Mức dBFS mà dưới đó một lần đo được coi là im lặng. |
| `silenceTimeoutMs` | `0` | Thời gian đầu vào phải im lặng liên tục. `0` là tắt tính năng. |
| `autoStopOnSilence` | `false` | Tự gọi `stop()` khi phát hiện khoảng lặng. |

Giá trị mặc định không bao giờ kích hoạt: `-160` dBFS thấp hơn mọi giá trị đo thực tế, còn thời gian chờ `0` là tắt kiểm tra. Hãy đặt **cả** ngưỡng lẫn thời gian chờ.

## Cách đo {#how-it-is-measured}

Việc phát hiện khoảng lặng chạy ở mỗi nhịp đo mức âm khi đang ghi, `meterUpdatesPerSecond` lần mỗi giây:

1. Nếu `db` của nhịp đó bằng hoặc cao hơn `silenceThresholdDb`, nó được tính là có tiếng và bộ đếm im lặng được đặt lại.
2. Nếu không, khoảng lặng tiếp tục. Nhịp im lặng đầu tiên sau khi có tiếng sẽ bắt đầu bộ đếm.
3. Khi khoảng lặng đạt `silenceTimeoutMs`, `onSilenceDetected` được gọi kèm thời gian đã im lặng, và nếu có `autoStopOnSilence` thì bản ghi dừng lại và `onComplete` được gọi.
4. Mỗi khoảng lặng chỉ gọi một lần. Nhịp tiếp theo bằng hoặc cao hơn ngưỡng sẽ kích hoạt lại cơ chế.

Mỗi nhịp được so sánh riêng lẻ. Không có phép lấy trung bình qua nhiều nhịp, nên chỉ một nhịp to, như một tiếng lách cách, cũng đặt lại bộ đếm.

Bộ đếm dùng thời gian thực và không được đặt lại khi `pause()`. Nếu người dùng tạm dừng giữa một khoảng lặng, thời gian tạm dừng cũng được tính, và sự kiện có thể được gọi ngay ở nhịp im lặng đầu tiên sau `resume()`.

## Chọn ngưỡng {#choosing-a-threshold}

Giá trị `db` chính là giá trị mà `onMeter` báo, và mỗi nền tảng đo theo cách khác nhau:

| Nền tảng | `db` là gì |
| --- | --- |
| iOS | Công suất trung bình trong nhịp vừa qua (`AVAudioRecorder.averagePower`). |
| Android | Giá trị đỉnh trong nhịp vừa qua, quy đổi sang dBFS. |

Giá trị đỉnh cao hơn giá trị trung bình, nên cùng một căn phòng sẽ đo to hơn trên Android. Hãy bắt đầu khoảng `-45` đến `-50` dBFS, log `onMeter` trên thiết bị thật trong phòng yên tĩnh và khi đang nói, rồi chọn một giá trị ở giữa, tách theo nền tảng nếu cần:

```tsx
silenceThresholdDb={Platform.OS === 'ios' ? -50 : -40}
```

Bạn cũng có thể xem các con số trong [demo trên trình duyệt](/vi/guide/demo), nơi cả hai cách quy đổi được tính từ micro của bạn.
