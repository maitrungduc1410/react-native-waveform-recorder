---
description: "Các phương thức ref của WaveformRecorderView, từ start, pause, stop đến cancel, enterPreview, seekPreview, và trạng thái mà mỗi phương thức có tác dụng."
---

# Phương thức của ref {#ref-methods}

Điều khiển view ghi âm qua một ref có kiểu `WaveformRecorderViewRef`:

```tsx
const ref = useRef<WaveformRecorderViewRef>(null);

<WaveformRecorderView ref={ref} style={{ height: 56 }} />;

ref.current?.start();
```

Các phương thức không trả về gì. Hãy theo dõi `onStateChange` để biết chuyện gì đã xảy ra. Lời gọi không phù hợp với trạng thái hiện tại sẽ bị bỏ qua, trừ những trường hợp báo [code `onError`](/vi/guide/events#error-codes).

| Phương thức | Có tác dụng khi | Làm gì |
| --- | --- | --- |
| `start()` | `idle`, `stopped`, `error`, `paused` | Xin quyền micro rồi bắt đầu bản ghi mới. Khi đang `paused` thì ghi tiếp bản hiện tại. |
| `pause()` | `recording` | Tạm dừng. `resume()` sẽ ghi tiếp vào cùng tệp. |
| `resume()` | `paused`, `preview` | Từ `paused`, ghi tiếp đoạn hiện tại. Từ `preview`, dừng trình phát và ghi một đoạn mới. |
| `stop()` | `recording`, `paused`, `preview` | Hoàn tất bản ghi, nối các đoạn và gọi `onComplete`. |
| `cancel()` | mọi trạng thái | Bỏ phiên, xóa các tệp của phiên và về `idle`. |
| `enterPreview()` | `recording`, `paused` | Tạm dừng nếu cần và nạp toàn bộ phần đã ghi vào trình phát có sẵn. |
| `exitPreview()` | `preview` | Thoát chế độ nghe lại và về `paused`. |
| `togglePreviewPlayback()` | `preview` | Phát hoặc tạm dừng âm thanh nghe lại. |
| `seekPreview(positionMs)` | `preview` | Di chuyển đầu phát và gọi `onSeek`. |

## start() {#start}

Trên Android, lớp JavaScript kiểm tra và xin `RECORD_AUDIO` trước. Trên iOS, phía native hiện hộp thoại hệ thống ở lần đầu. Nếu bị từ chối quyền, `onPermissionDenied` được gọi và trạng thái không đổi.

Từ `idle`, `stopped` hoặc `error`, `start()` bắt đầu một phiên mới. Bắt đầu lại sau `stop()` không xóa tệp trước đó, nhưng một lần `cancel()` hoặc unmount sau đó thì có thể, xem [Giữ lại tệp](/vi/guide/export#keep-the-file).

## stop() {#stop}

`stop()` trả về trước khi tệp sẵn sàng. Với một đoạn ghi, `onComplete` được gọi ngay. Với nhiều đoạn, các tệp được nối trước rồi mới gọi `onComplete`. Nếu chưa ghi được gì, trạng thái chuyển sang `stopped` mà không có `onComplete`.

Nếu đã đặt `minDurationMs` và `stop()` được gọi khi đang ghi hoặc tạm dừng với lượng âm thanh ít hơn mức đó, bản ghi sẽ bị bỏ: các tệp bị xóa, trạng thái về `idle` và `onError` được gọi với code `'min-duration'`.

## cancel() {#cancel}

`cancel()` dừng mọi thứ và xóa các tệp đoạn ghi của phiên. Phương thức này vẫn có tác dụng sau `stop()`, và khi đó có thể xóa luôn tệp mà `onComplete` đã đưa cho bạn. Hãy sao chép tệp đó trước nếu còn cần.

## Gọi phương thức trên view bị ẩn {#hidden-view}

Trên iOS, `display: 'none'` sẽ unmount view native, nên ref là `null`, các lời gọi bị mất và các tệp ghi âm bị dọn đi. Nếu cần giữ view ghi âm được mount mà không hiển thị, hãy đẩy nó ra ngoài màn hình, ví dụ `position: 'absolute', left: -100000`.
