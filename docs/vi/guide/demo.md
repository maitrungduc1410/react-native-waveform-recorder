---
description: "Thử bản mô phỏng view ghi âm trên trình duyệt: cột dạng sóng từ micro của bạn, tạm dừng, nghe lại có tua, cử chỉ trượt và các sự kiện tương ứng."
---

# Demo trên trình duyệt {#browser-demo}

Thư viện chỉ chạy trên iOS và Android, nên trang này dùng một bản mô phỏng trên web. Bản này vẽ lại view native trên canvas với cùng bố cục, hiệu ứng cột và giá trị mặc định, đồng thời áp dụng cùng quy tắc trạng thái cho các phương thức của ref. Bạn có thể dùng nó để làm quen với props và xem sự kiện nào được gọi, vào lúc nào.

<ClientOnly>
  <RecorderDemo />
</ClientOnly>

## Nên thử gì {#what-to-try}

- Nhấn `start()` rồi nói. Các cột đi vào từ bên phải theo `samplesPerSecond`, còn `onMeter` cập nhật `meterUpdatesPerSecond` lần mỗi giây.
- Trong lúc ghi, hãy kéo trên khung ghi âm. Kéo sang trái sẽ báo `cancelProgress`, và khi vượt `slideToCancelThresholdDp` thì gọi `onSlideCancel`; lúc đó demo gọi `cancel()`, đúng như app của bạn sẽ làm. Kéo lên sẽ gọi `onSlideLock`; nhãn "Đã khóa" là UI của app, thư viện không vẽ gì cho nó.
- Nhấn `enterPreview()`, rồi phát và kéo trên các cột để tua. `resume()` từ chế độ nghe lại sẽ bắt đầu một đoạn ghi mới.
- Bật phát hiện khoảng lặng, giữ im lặng và quan sát `onSilenceDetected`.
- Đặt `maxDurationMs` là `10000` để thấy `onMaxDurationReached` rồi đến `onComplete`.
- Tắt `enablePreview` hoặc `enableContinueRecording` để xem các code `onError` tương ứng.

## Khác gì so với view native {#how-it-differs}

| | View native | Demo này |
| --- | --- | --- |
| Nguồn âm thanh | `AVAudioRecorder`, `MediaRecorder` hoặc `AudioRecord` | `getUserMedia` và Web Audio, hoặc giọng nói mô phỏng |
| Tệp đầu ra | Mặc định `m4a`, xem [`output`](/vi/guide/props#output) | Luôn là WAV 16-bit một kênh trong URL `blob:` |
| Mức âm | iOS dùng công suất trung bình, Android dùng giá trị đỉnh | Tính cả hai cách từ mẫu âm thanh của trình duyệt |
| Đơn vị cử chỉ | dp trên Android, point trên iOS | Pixel CSS |
| Bị từ chối quyền | `onPermissionDenied` | `onPermissionDenied`, sau đó bạn có thể chuyển sang giọng nói mô phỏng |

Demo không tải âm thanh lên đâu cả. Mọi thứ nằm trong trang và bị bỏ đi khi bạn rời trang.
