---
description: "Thêm trượt để hủy và trượt để khóa cho view ghi âm: ngưỡng, sự kiện tiến độ, cách hai cử chỉ cạnh tranh nhau và app của bạn cần làm gì với từng sự kiện."
---

# Cử chỉ trượt {#slide-gestures}

Các app nhắn tin thường cho người dùng kéo sang trái để bỏ bản ghi và kéo lên để khóa, nhờ đó có thể buông tay mà vẫn tiếp tục ghi. View ghi âm theo dõi cả hai thao tác kéo ở phía native và báo cho bạn biết chuyện gì đã xảy ra. Còn làm gì tiếp là do app của bạn quyết định.

```tsx
const [locked, setLocked] = useState(false);

<WaveformRecorderView
  ref={ref}
  style={{ height: 56 }}
  enableSlideToCancel
  enableSlideToLock
  onSlideProgress={(e) => {
    cancelHint.setValue(e.cancelProgress);
    lockHint.setValue(e.lockProgress);
  }}
  onSlideCancel={() => ref.current?.cancel()}
  onSlideLock={() => setLocked(true)}
/>
```

## Cách hoạt động {#how-it-works}

- Thao tác kéo được theo dõi **trên chính view ghi âm**, và chỉ khi trạng thái là `recording`. Một lần chạm bắt đầu trên view khác, như một nút ghi âm riêng, sẽ không được nhận. Cử chỉ nào bị tắt thì luôn báo tiến độ `0`.
- Tiến độ là quãng đường kéo chia cho ngưỡng, giới hạn trong `[0, 1]`: `cancelProgress` tăng khi ngón tay sang trái, `lockProgress` tăng khi ngón tay đi lên. Kéo sang phải hoặc xuống dưới được tính là `0`.
- `onSlideProgress` được gọi mỗi khi ngón tay di chuyển. Nó báo `0, 0` khi bắt đầu kéo, và báo lại khi nhấc tay mà chưa vượt ngưỡng nào, để bạn đặt lại các gợi ý.
- Khi một giá trị tiến độ chạm `1`, sự kiện tương ứng được gọi **một lần** và thao tác kéo kết thúc. Nếu cả hai cùng chạm `1` trong một lần di chuyển, hủy được ưu tiên.
- Ngưỡng tính bằng dp trên Android và point trên iOS. Android còn chờ vượt qua touch slop của hệ thống rồi mới tính là đang kéo.

| Prop | Mặc định |
| --- | --- |
| `enableSlideToCancel` | `false` |
| `slideToCancelThresholdDp` | `80` |
| `enableSlideToLock` | `false` |
| `slideToLockThresholdDp` | `80` |

## App của bạn cần làm gì {#what-your-app-does}

**Khi có `onSlideCancel`:** thư viện **không** tự hủy. Hãy gọi `ref.current?.cancel()` để bỏ bản ghi, hoặc làm việc khác, chẳng hạn hỏi lại người dùng.

**Khi có `onSlideLock`:** thư viện không thay đổi gì, việc ghi vẫn tiếp tục. Hãy hiển thị UI khóa của riêng bạn, ví dụ nút dừng và nhãn "đã khóa". Không cần làm gì thêm để tiếp tục ghi sau khi nhấc tay, vì view ghi âm không dừng khi thao tác chạm kết thúc.

**Gợi ý:** view không vẽ nhãn "trượt để hủy" hay biểu tượng ổ khóa. Hãy dùng `onSlideProgress` để tự tạo hiệu ứng, ví dụ làm mờ dần một nhãn khi `cancelProgress` tăng.

## Nhấn giữ để ghi {#hold-to-record}

Cử chỉ có sẵn chỉ theo dõi lần chạm **bắt đầu trên view ghi âm sau khi việc ghi đã bắt đầu**. Ngón tay đã đặt sẵn từ lúc gọi `start()`, ví dụ trên một nút nhấn giữ để ghi, sẽ không được nhận, kể cả khi view ghi âm hiện ra ngay dưới ngón tay.

Với luồng nhấn giữ để ghi, hãy tự theo dõi thao tác kéo trên nút ghi âm của bạn (bằng `PanResponder` hoặc `react-native-gesture-handler`): gọi `start()` khi nhấn, `cancel()` khi ngón tay đã kéo đủ xa sang trái, và khi thả tay thì ghi tiếp hoặc `stop()` tùy thiết kế. Cử chỉ có sẵn phù hợp với luồng người dùng chạm nút ghi trước rồi mới kéo trên view ghi âm.

Bạn có thể thử cả hai cử chỉ bằng chuột hoặc ngón tay trong [demo trên trình duyệt](/vi/guide/demo).
