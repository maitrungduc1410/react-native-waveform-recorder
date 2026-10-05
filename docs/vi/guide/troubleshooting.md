---
description: "Cách xử lý sự cố thường gặp của react-native-waveform-recorder: không ghi được, mất tệp, không có cột, cử chỉ không chạy, không phát hiện khoảng lặng, Expo."
---

# Khắc phục sự cố {#troubleshooting}

## Gọi start() mà không có gì xảy ra {#start-does-nothing}

- Kiểm tra `onPermissionDenied` và `onError`. Bị từ chối quyền thì `onPermissionDenied` được gọi, bộ ghi lỗi thì `onError` được gọi với code `'start'` hoặc `'session'`.
- Trên iOS, nếu người dùng đã từ chối micro một lần, hộp thoại sẽ không bao giờ hiện lại. Hãy đưa họ sang Cài đặt bằng `Linking.openSettings()`.
- Đảm bảo `NSMicrophoneUsageDescription` có trong `Info.plist`. Nếu thiếu, iOS sẽ đóng app khi bắt đầu ghi.
- Đảm bảo ref đã được gán. Trên iOS, view ghi âm nằm trong view cha có `display: 'none'` sẽ bị unmount và ref là `null`.
- Kiểm tra xem bạn có đặt prop `state` không. Prop này chuyển view sang chế độ controlled đang thử nghiệm, khi đó các phương thức của ref không ghi âm, xem [Trạng thái có kiểm soát](/vi/guide/props#controlled-state).

## View trống hoặc không có chiều cao {#no-height}

View không có kích thước tự nhiên. Hãy đặt chiều cao trong `style`, ví dụ `height: 56`.

## Tệp từ onComplete biến mất {#file-is-gone}

`cancel()` (kể cả sau `stop()`) và việc unmount view sẽ xóa các tệp đoạn ghi của phiên, và với bản ghi không qua bước nghe lại rồi ghi tiếp thì đó chính là tệp được trả về. Hãy sao chép hoặc di chuyển tệp trong `onComplete`, xem [Giữ lại tệp](/vi/guide/export#keep-the-file). Ngoài ra, hệ thống có thể dọn thư mục cache bất cứ lúc nào.

## stop() bỏ mất bản ghi {#stop-discarded}

Bạn đã đặt `minDurationMs` và bản ghi ngắn hơn mức đó. Trạng thái về `idle` và `onError` được gọi với code `'min-duration'`. Hãy giảm hoặc bỏ `minDurationMs`, hoặc hiện gợi ý cho người dùng khi nhận code này.

## output.uri bị bỏ qua {#output-uri-ignored}

- Trên iOS, hãy truyền URI `file://`, không phải đường dẫn thường.
- Sau khi nghe lại rồi ghi tiếp, kết quả là một tệp nối mới trong thư mục cache, không phải `output.uri`. Hãy dùng `onComplete.uri`.

## Cột gần như không nhúc nhích, hoặc nhảy quá nhiều {#bars}

Các cột đi theo mức âm của từng nền tảng: công suất trung bình trên iOS, giá trị đỉnh trên Android. Giọng nói nhỏ trên iOS có thể nằm sát đáy, vì mọi giá trị từ -60 dB trở xuống được vẽ là `0`. Đổi mật độ hiển thị bằng `samplesPerSecond`, `barWidth` và `barGap`. Hiện tại `recordingMode` và `newSampleEntry` không có tác dụng gì về mặt hiển thị.

## Cử chỉ trượt không chạy {#gestures-do-not-fire}

- Bật `enableSlideToCancel` và/hoặc `enableSlideToLock`. Mặc định cả hai đều là `false`.
- Thao tác kéo phải bắt đầu **trên view ghi âm** khi trạng thái là `recording`. Ngón tay đã đặt sẵn từ trước khi bắt đầu ghi, ví dụ trên nút nhấn giữ, sẽ không được theo dõi. Xem [Nhấn giữ để ghi](/vi/guide/gestures#hold-to-record).
- `onSlideCancel` không tự hủy. Hãy gọi `ref.current?.cancel()` trong handler.

## Không bao giờ phát hiện được khoảng lặng {#silence-never-detected}

Đặt cả `silenceThresholdDb` lẫn `silenceTimeoutMs`. Giá trị mặc định (`-160` và `0`) không bao giờ kích hoạt. Nếu vẫn không chạy, căn phòng ồn hơn ngưỡng của bạn; hãy log `onMeter` rồi nâng ngưỡng lên, xem [Chọn ngưỡng](/vi/guide/silence-detection#choosing-a-threshold).

## Không nhận được chunk PCM {#no-pcm-chunks}

`enablePcmStream` chỉ hoạt động khi `output.format` là `'wav'`, và phải bật trước khi `start()`.

## Ghi âm dừng khi app chạy nền {#background}

Bật `backgroundRecording` và làm phần thiết lập native ở [Cài đặt](/vi/guide/installation#background-recording). Trên iOS, để ý `onError` với code `'background-capability'`. Trên Android, tìm cảnh báo `startForegroundService failed` trong logcat, nghĩa là service chưa được khai báo.

## Tệp opus không phát được {#opus}

iOS ghi Opus trong container `.caf`, nhiều trình phát ngoài hệ sinh thái Apple không mở được. Trên Android dưới API 29, tệp là AAC dù mang tên `.ogg`. Hãy dùng `m4a` nếu tệp được chia sẻ giữa các nền tảng.

## Expo: không tìm thấy module {#expo}

Thư viện không chạy trong Expo Go. Hãy build development client sau khi thêm config plugin và chạy `npx expo prebuild --clean`. Xem [Expo](/vi/guide/installation#expo).

## Render trên web bị lỗi {#web}

View này chỉ dành cho native. Hãy render nội dung thay thế trên web, xem [Lưu ý theo nền tảng](/vi/guide/platform-notes#web).
