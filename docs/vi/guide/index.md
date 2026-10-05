---
description: "Tổng quan về react-native-waveform-recorder: view ghi âm Fabric với dạng sóng native, nghe lại, cử chỉ trượt, phát hiện khoảng lặng và xuất 64 cột."
---

# react-native-waveform-recorder là gì? {#what-is-it}

`react-native-waveform-recorder` là một view React Native ghi âm từ micro và vẽ dạng sóng ngay trong lúc ghi. Đây là nửa "ghi" của tính năng tin nhắn thoại: người dùng ghi âm, có thể nghe lại rồi ghi tiếp, còn bạn nhận về một tệp âm thanh hoàn chỉnh cùng bản tóm tắt độ to gồm 64 cột để hiển thị trong bong bóng chat.

Mọi thứ chạy theo từng khung hình đều là native. Mức âm của micro được đọc bằng Swift (`AVAudioRecorder`) và Kotlin (`MediaRecorder` hoặc `AudioRecord`), các cột được vẽ bởi một view native. JavaScript chỉ gửi lệnh qua [ref](/vi/guide/ref-methods) và nhận [sự kiện](/vi/guide/events).

## Tính năng {#features}

| Tính năng | Xem ở |
| --- | --- |
| Dạng sóng theo thời gian thực, tùy chỉnh được cột, màu, đồng hồ và vạch giữ chỗ | [Props](/vi/guide/props) |
| Tạm dừng và ghi tiếp, nghe lại có tua, ghi tiếp sau khi nghe lại | [Đoạn ghi, tạm dừng và nghe lại](/vi/guide/segments) |
| Trượt để hủy và trượt để khóa | [Cử chỉ trượt](/vi/guide/gestures) |
| Sự kiện khi im lặng một lúc, có thể tự động dừng | [Phát hiện khoảng lặng](/vi/guide/silence-detection) |
| Xuất `m4a`, `aac`, `wav` và `opus`, kèm 64 cột cho bong bóng chat | [Dữ liệu xuất và trình phát](/vi/guide/export) |
| Các chunk PCM 16-bit trong lúc ghi | [Luồng PCM](/vi/guide/pcm-stream) |
| Ghi âm khi app chạy nền | [Lưu ý theo nền tảng](/vi/guide/platform-notes#background-recording) |

## Nền tảng {#platforms}

| | Hỗ trợ |
| --- | --- |
| iOS | Có (Swift, AVFoundation). Phiên bản tối thiểu theo bản React Native bạn dùng. |
| Android | Có (Kotlin), từ API 24. Định dạng `opus` cần API 29. |
| New Architecture (Fabric) | Bắt buộc. Không có bản cho Old Architecture. |
| Expo | Development build và `expo prebuild`, có config plugin. Không chạy trong Expo Go. |
| Web | Không. Render view này trên web sẽ ném lỗi. |

Ngoài React Native, thư viện không phụ thuộc gói JavaScript nào khác.

## Luồng sử dụng {#how-it-fits-together}

1. Render `<WaveformRecorderView>` với chiều cao trong `style`, ví dụ `height: 56`.
2. Gọi `ref.current?.start()` từ nút ghi âm. Thư viện sẽ xin quyền micro trước.
3. Trong lúc ghi, view vẽ các cột và gọi `onMeter`. Bạn có thể `pause()`, `resume()`, `enterPreview()` để nghe lại, hoặc `cancel()`.
4. Gọi `stop()`. View hoàn tất tệp rồi gọi `onComplete` kèm URI `file://`, thời lượng, kích thước, định dạng và 64 giá trị `samples`.
5. Hiển thị kết quả bằng [react-native-waveform-player](https://maitrungduc1410.github.io/react-native-waveform-player/), truyền vào URI và `samples`.

::: warning Giữ lại tệp trước khi hủy hoặc unmount
`cancel()` và việc gỡ view khỏi màn hình sẽ xóa các tệp ghi âm của phiên. Với bản ghi không qua bước nghe lại rồi ghi tiếp, trong đó có cả tệp mà `onComplete` đưa cho bạn. Hãy sao chép hoặc di chuyển tệp trong `onComplete` nếu cần dùng về sau. Xem [Dữ liệu xuất và trình phát](/vi/guide/export#keep-the-file).
:::

## Bước tiếp theo {#next-steps}

- [Cài đặt](/vi/guide/installation): quyền, ghi âm khi chạy nền và config plugin của Expo.
- [Bắt đầu nhanh](/vi/guide/quick-start): một màn hình ghi, nghe lại và gửi hoàn chỉnh.
- [Demo trên trình duyệt](/vi/guide/demo): thử props và sự kiện với micro của chính bạn.
