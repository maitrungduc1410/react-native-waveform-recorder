---
description: "Cách tạm dừng, ghi tiếp, nghe lại và ghi tiếp sau khi nghe hoạt động trong react-native-waveform-recorder, cách nối các đoạn ghi và nơi lưu tệp ghi âm."
---

# Đoạn ghi, tạm dừng và nghe lại {#segments}

Một phiên ghi âm có thể được tạm dừng, nghe lại rồi ghi tiếp trước khi hoàn tất. Trang này giải thích các trạng thái, khi nào một đoạn ghi mới bắt đầu và cuối cùng thứ gì được lưu xuống đĩa.

## Trạng thái {#states}

```
idle ──start()──▶ recording ──stop()──▶ stopped ──▶ onComplete
                   │     ▲
           pause() │     │ resume() / start()
                   ▼     │
                  paused ──────stop()──────▶ stopped
                   │  ▲
    enterPreview() │  │ exitPreview()
                   ▼  │
                  preview ──resume()──▶ recording (đoạn mới)
                     └──────stop()──────▶ stopped
```

`enterPreview()` cũng dùng được từ `recording`; nó sẽ tạm dừng trước. `cancel()` đưa về `idle` từ mọi trạng thái. `'error'` được báo khi bộ ghi không khởi động hoặc không ghi tiếp được.

| Trạng thái | Đang diễn ra |
| --- | --- |
| `idle` | Chưa ghi gì, hoặc phiên đã bị hủy. |
| `recording` | Micro đang mở, các cột được vẽ và `onMeter` được gọi. |
| `paused` | Đang tạm dừng. Cũng được báo sau `exitPreview()`. |
| `preview` | Phần đã ghi được nạp vào trình phát có sẵn. |
| `stopped` | Tệp đã hoàn tất và `onComplete` đã được gọi. |
| `error` | Khởi động hoặc ghi tiếp thất bại. Chi tiết có trong `onError`. |

## Tạm dừng và ghi tiếp {#pause-and-resume}

`pause()` và `resume()` tiếp tục ghi vào **cùng một tệp** trên cả hai nền tảng. Đồng hồ và `durationMs` không tính thời gian tạm dừng. Khi tạm dừng, các cột đứng yên tại chỗ.

## Nghe lại {#preview}

`enterPreview()` đóng đoạn ghi hiện tại và nạp toàn bộ phần đã ghi vào trình phát có sẵn. Lúc này view hiện nút phát (trừ khi `showPlayButton={false}`), các cột của cả bản ghi được co lại vừa chiều rộng view, và đồng hồ hiển thị vị trí đang phát.

- Chạm nút phát hoặc gọi `togglePreviewPlayback()` để phát hoặc tạm dừng.
- Kéo trên các cột để tua. `onSeek` được gọi khi thả tay.
- `seekPreview(positionMs)` để tua bằng code.
- `onPlaybackTimeUpdate` được gọi khoảng 30 lần mỗi giây khi đang phát.

Trên iOS, thao tác tua dùng gesture recognizer nên thắng được cử chỉ vuốt để quay lại của React Navigation. Trên Android, view yêu cầu view cha không chặn thao tác chạm trong lúc tua.

Nếu chưa ghi được gì, `enterPreview()` gọi `onError` với code `'preview-snapshot'`. Khi `enablePreview={false}`, code sẽ là `'preview-disabled'`.

## Ghi tiếp sau khi nghe lại {#continue-recording}

Từ chế độ nghe lại có ba lối ra:

| Lời gọi | Kết quả |
| --- | --- |
| `resume()` | Dừng trình phát và bắt đầu ghi một **đoạn mới**. Các cột tiếp nối từ chỗ bản ghi kết thúc. |
| `exitPreview()` | Về `paused`. Lần `resume()` hoặc `start()` tiếp theo cũng bắt đầu một đoạn mới. |
| `stop()` | Hoàn tất bản ghi mà không ghi thêm. |

Khi `enableContinueRecording={false}`, `resume()` lúc đang nghe lại sẽ gọi `onError` với code `'continue-disabled'` và không có gì thay đổi. `exitPreview()` và `stop()` vẫn hoạt động.

## Nối các đoạn ghi {#joining-segments}

Khi `stop()`, bản ghi có nhiều đoạn được nối thành một tệp trước khi gọi `onComplete`:

| Định dạng | iOS | Android |
| --- | --- | --- |
| `wav` | Nối dữ liệu PCM, ghi header mới | Nối dữ liệu PCM, ghi header mới |
| `m4a`, `aac` | `AVAssetExportSession`, preset Apple M4A | `MediaMuxer`, không mã hóa lại |
| `opus` | `AVAssetExportSession`, passthrough | `MediaMuxer`, không mã hóa lại |

Nếu nối thất bại, `onError` được gọi với code `'concat'` và `onComplete` vẫn được gọi với đoạn đầu tiên, để người dùng giữ được ít nhất một phần âm thanh.

Các đoạn `wav` được đọc hết vào bộ nhớ để nối. Bản ghi `wav` rất dài có bước nghe lại và ghi tiếp có thể tốn nhiều bộ nhớ, nhất là trên iOS. Với bản ghi dài, nên dùng `m4a`.

## Tệp được lưu ở đâu {#where-files-go}

| Bản ghi | Tệp |
| --- | --- |
| Một đoạn (không nghe lại rồi ghi tiếp) | `output.uri` nếu bạn đặt, nếu không thì một tệp `wfr_*` mới trong thư mục cache của app. |
| Nhiều đoạn | Đoạn 1 được lưu như trên, các đoạn sau nằm cạnh nó với hậu tố `_seg2`, `_seg3`, ... Kết quả sau khi nối là một tệp `wfr_concat_*` mới trong thư mục cache, nên `output.uri` không phải tệp cuối cùng. |
| Bản nghe lại của nhiều đoạn | Một tệp nối tạm trong thư mục cache, bị xóa khi thoát chế độ nghe lại. |

`output.uri` phải là URI `file://`. Android nhận cả đường dẫn thường, iOS thì không.

Hệ thống có thể dọn thư mục cache. Hãy chuyển tệp cuối cùng sang nơi lưu lâu dài, và làm việc đó trước khi gọi `cancel()` hoặc unmount view, vì cả hai đều xóa các tệp đoạn ghi của phiên. Xem [Giữ lại tệp](/vi/guide/export#keep-the-file).
