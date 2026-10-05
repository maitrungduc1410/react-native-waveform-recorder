---
description: "Khác biệt giữa iOS và Android trong react-native-waveform-recorder: audio session, bộ ghi, foreground service, mức âm, định dạng, bố cục và web."
---

# Lưu ý theo nền tảng {#platform-notes}

Hai bản native theo cùng một thiết kế nhưng dựa trên các API âm thanh khác nhau. Trang này liệt kê những khác biệt bạn có thể gặp.

## iOS {#ios}

- **Bộ ghi.** Mọi định dạng đều được ghi bằng `AVAudioRecorder`. Mức âm là công suất trung bình của nó trong nhịp vừa qua.
- **Audio session.** Khi `start()`, thư viện đặt `AVAudioSession` dùng chung sang category `playAndRecord` với các tùy chọn `defaultToSpeaker` và `allowBluetooth`, rồi kích hoạt nó. Session được tắt sau `stop()` và `cancel()`. Nếu app của bạn phát âm thanh khác cùng lúc, âm thanh đó có thể bị ảnh hưởng; hãy cấu hình lại session sau đó nếu cần.
- **Gián đoạn.** Thư viện không theo dõi các gián đoạn của audio session như cuộc gọi điện, cũng không theo dõi trạng thái app. Hãy dùng `AppState` để tự tạm dừng hoặc dừng nếu app cần.
- **Quyền.** Hộp thoại hệ thống xuất hiện ở lần `start()` đầu tiên. Sau khi bị từ chối, iOS không bao giờ hỏi lại và mỗi lần `start()` đều gọi `onPermissionDenied`.
- **`output.uri`.** Phải là URI `file://`. Không nhận đường dẫn thường.

## Android {#android}

- **Bộ ghi.** `m4a`, `aac` và `opus` dùng `MediaRecorder`; mức âm là biên độ lớn nhất kể từ nhịp trước. `wav` dùng `AudioRecord` với bộ ghi PCM 16-bit; mức âm là giá trị đỉnh của buffer mới nhất. Cả hai đều dùng nguồn âm thanh `MIC`.
- **Quyền.** Lớp JavaScript xin `RECORD_AUDIO` trước mỗi lần `start()`. Quyền này đã được khai báo trong manifest của thư viện.
- **Bitrate.** `output.bitrate` bị giới hạn trong một khoảng phụ thuộc `output.quality`, xem [Định dạng](/vi/guide/export#formats).
- **Opus.** Cần API 29. Dưới mức đó, engine ghi AAC và gọi `onError` với code `'format-unsupported'`.
- **Tua.** Khi nghe lại, view yêu cầu view cha không chặn thao tác chạm, nên tua vẫn hoạt động bên trong `ScrollView` hoặc pager.

## Ghi âm khi chạy nền {#background-recording}

| | iOS | Android |
| --- | --- | --- |
| Thứ giữ cho việc ghi tiếp tục | Mục `audio` trong `UIBackgroundModes` | Một foreground service loại `microphone` |
| Prop `backgroundRecording` làm gì | Kiểm tra mục `audio` và gọi `onError` với code `'background-capability'` một lần mỗi lần mở app nếu thiếu | Khởi động service khi bắt đầu ghi và dừng nó khi `stop()`, `cancel()` hoặc khi có lỗi |
| Nếu thiếu thiết lập native | Việc ghi tạm dừng khi app xuống nền | Service không khởi động được và thư viện chỉ ghi một cảnh báo vào logcat |

Trên iOS, background mode có hiệu lực ngay khi có trong `Info.plist`, bất kể prop là gì. Trên Android, service vẫn chạy khi đang tạm dừng và khi nghe lại. Từ Android 13, thông báo của service chỉ hiện trong ngăn thông báo nếu app có quyền `POST_NOTIFICATIONS`; service vẫn chạy trong cả hai trường hợp.

## Giá trị mức âm {#meter-values}

iOS báo công suất trung bình còn Android báo giá trị đỉnh, nên với cùng một âm thanh, Android cho `amplitude` và `db` cao hơn. Điều này ảnh hưởng tới các cột, `onMeter`, phần xuất 64 cột và [ngưỡng khoảng lặng](/vi/guide/silence-detection#choosing-a-threshold).

## Bố cục {#layout}

| | iOS | Android |
| --- | --- | --- |
| Lề trong | 12 pt | 12 dp |
| Nút phát khi nghe lại | 60% chiều cao view, tối đa 36 pt | 32 dp |
| Nhãn thời gian | Rộng 48 pt, 13 pt semibold | Rộng 48 dp, 13 sp |
| `futureBarColor` mặc định | `unplayedBarColor` với độ mờ 60% | `unplayedBarColor` với độ mờ nhân 0,6 |

## Vòng đời Fabric {#fabric-lifecycle}

- Trên iOS, `display: 'none'` sẽ unmount view native. Ref thành `null`, các lời gọi bị mất và tệp của phiên bị dọn đi. Nếu view phải được giữ mount, hãy đẩy nó ra ngoài màn hình.
- Khi view bị gỡ (iOS recycle, Android `onDropViewInstance`), bộ ghi bị hủy và các tệp đoạn ghi bị xóa, xem [Giữ lại tệp](/vi/guide/export#keep-the-file).

## Web {#web}

Gói có entry point cho web để code dùng chung vẫn bundle được, nhưng render `WaveformRecorderView` trên web sẽ ném lỗi và `ensureMicrophonePermission()` trả về `false`. Hãy render nội dung khác trên web, ví dụ đặt sau điều kiện `Platform.OS !== 'web'`.
