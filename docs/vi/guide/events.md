---
description: "Các sự kiện của WaveformRecorderView: đổi trạng thái, mức âm, hoàn tất kèm 64 cột, lỗi và code lỗi, nghe lại, cử chỉ trượt, khoảng lặng và luồng PCM."
---

# Sự kiện {#events}

Mọi sự kiện đều là props của `WaveformRecorderView`. Kiểu dữ liệu của payload có trong [tài liệu API](/api/).

| Sự kiện | Payload | Khi nào |
| --- | --- | --- |
| `onStateChange` | `{ state, durationMs }` | Mỗi lần đổi trạng thái. |
| `onMeter` | `{ amplitude, peak, db }` | `meterUpdatesPerSecond` lần mỗi giây khi đang ghi. |
| `onComplete` | xem [bên dưới](#oncomplete) | Một lần, khi tệp cuối cùng đã ghi xong sau `stop()` hoặc khi tự dừng. |
| `onMaxDurationReached` | không có | Khi đạt `maxDurationMs`, ngay trước lúc tự dừng. |
| `onPermissionDenied` | không có | Khi `start()` không xin được quyền micro. |
| `onError` | `{ message, code? }` | Cảnh báo và lỗi, xem [code lỗi](#error-codes). |
| `onSeek` | `{ positionMs }` | Khi nghe lại, lúc kết thúc thao tác tua và sau `seekPreview()`. |
| `onPlaybackTimeUpdate` | `{ positionMs, durationMs }` | Khoảng 30 lần mỗi giây khi âm thanh nghe lại đang phát. |
| `onSlideProgress` | `{ cancelProgress, lockProgress }` | Khi người dùng kéo trên view trong lúc ghi. |
| `onSlideCancel` | không có | Một lần mỗi lần kéo, khi vượt ngưỡng hủy. |
| `onSlideLock` | không có | Một lần mỗi lần kéo, khi vượt ngưỡng khóa. |
| `onSilenceDetected` | `{ durationMs }` | Một lần cho mỗi khoảng lặng, xem [Phát hiện khoảng lặng](/vi/guide/silence-detection). |
| `onPcmChunk` | `{ chunk, sampleRate, channels, bytesPerSample, timestampMs }` | Khoảng mỗi `pcmChunkMs` khi luồng PCM đang bật, xem [Luồng PCM](/vi/guide/pcm-stream). |

## onStateChange {#onstatechange}

`state` là một trong `'idle'`, `'recording'`, `'paused'`, `'preview'`, `'stopped'` hoặc `'error'`. `durationMs` là thời lượng đã ghi tới lúc đó, không tính thời gian tạm dừng. Các bước chuyển trạng thái có ở [Đoạn ghi, tạm dừng và nghe lại](/vi/guide/segments#states).

## onMeter {#onmeter}

| Trường | Ý nghĩa |
| --- | --- |
| `amplitude` | Mức âm hiện tại trong `[0, 1]`, chính là giá trị dùng cho cột mới nhất. |
| `peak` | `amplitude` cao nhất từ đầu phiên tới giờ. |
| `db` | Mức âm hiện tại theo dBFS. `0` là mức tối đa, càng nhỏ càng âm. |

Hai nền tảng đo mức âm theo cách khác nhau, nên cùng một âm thanh sẽ cho số khác nhau. iOS báo công suất trung bình trong nhịp vừa qua và quy đổi theo `10^(db / 20)`, mọi giá trị từ -60 dB trở xuống được hiển thị là `0`. Android báo giá trị đỉnh kể từ nhịp trước và quy đổi bằng căn bậc hai của giá trị đỉnh tuyến tính. Đừng so sánh giá trị thô giữa hai nền tảng.

## onComplete {#oncomplete}

| Trường | Kiểu | Ý nghĩa |
| --- | --- | --- |
| `uri` | `string` | URI `file://` của bản ghi. |
| `durationMs` | `number` | Thời lượng đã ghi, cộng dồn qua mọi đoạn. |
| `format` | `string` | Giá trị `output.format` bạn đã chọn. |
| `mimeType` | `string` | Kiểu MIME, xem [Định dạng](/vi/guide/export#formats). |
| `sizeBytes` | `number` | Kích thước tệp. |
| `sampleRate` | `number` | Sample rate tính bằng Hz. |
| `channels` | `number` | Số kênh. |
| `samples` | `number[]` | 64 giá trị trong `[0, 1]` cho bong bóng chat, xem [Xuất 64 cột](/vi/guide/export#the-64-bar-export). |
| `peakAmplitude` | `number` | `amplitude` cao nhất của cả phiên. |

`onComplete` không được gọi khi chưa ghi được gì, khi gọi `cancel()`, hoặc khi `minDurationMs` bỏ bản ghi.

## Code lỗi {#error-codes}

`onError` dùng cho cả lỗi thật lẫn cảnh báo về những lời gọi bị bỏ qua. Hãy kiểm tra `code`:

| Code | Ý nghĩa |
| --- | --- |
| `start` | Bộ ghi không khởi động được. Trạng thái chuyển sang `'error'`. |
| `session` | iOS không cấu hình được audio session. Trạng thái chuyển sang `'error'`. |
| `resume` | Ghi tiếp sau `pause()` thất bại. Trạng thái chuyển sang `'error'`. |
| `media-recorder` | Android: `MediaRecorder` báo lỗi trong lúc ghi. |
| `min-duration` | Gọi `stop()` khi chưa đủ `minDurationMs`. Bản ghi đã bị bỏ. |
| `preview-disabled` | Gọi `enterPreview()` khi `enablePreview={false}`. |
| `continue-disabled` | Gọi `resume()` khi đang nghe lại mà `enableContinueRecording={false}`. |
| `preview-snapshot` | Không chuẩn bị được bản nghe lại, ví dụ vì chưa ghi được gì. |
| `preview-load` | Trình phát không nạp được âm thanh để nghe lại. |
| `concat` | Nối các đoạn ghi thất bại. `onComplete` vẫn được gọi với đoạn đầu tiên để không mất âm thanh. |
| `format-unsupported` | Chọn `opus` trên Android dưới API 29. Engine ghi AAC thay thế. |
| `pcm-stream` | iOS: luồng PCM không mở được tệp WAV. |
| `background-capability` | iOS: bật `backgroundRecording` nhưng thiếu `audio` trong `UIBackgroundModes`. Chỉ gọi một lần. |

Từ trạng thái `'error'`, gọi `start()` sẽ bắt đầu một phiên mới.
