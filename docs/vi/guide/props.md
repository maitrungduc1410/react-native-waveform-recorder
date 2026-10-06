---
description: "Toàn bộ props của WaveformRecorderView kèm kiểu và giá trị mặc định native: định dạng xuất, giới hạn, giao diện cột và khung, nghe lại, cử chỉ, PCM."
---

# Props {#props}

`WaveformRecorderView` nhận các props dưới đây cùng các props chuẩn của `View` như `style` và `testID`. Hãy đặt chiều cao cho view, vì view không có kích thước tự nhiên. Các props sự kiện nằm ở trang [Sự kiện](/vi/guide/events). Kiểu dữ liệu có trong [tài liệu API](/api/type-aliases/WaveformRecorderViewProps).

## Đầu ra {#output}

Mọi thiết lập đầu ra nằm trong một prop lồng nhau là `output`. Trường nào cũng không bắt buộc.

```tsx
<WaveformRecorderView
  output={{ format: 'm4a', sampleRate: 44100, channels: 1, bitrate: 128000, quality: 'high' }}
/>
```

| Trường | Kiểu | Mặc định | Ghi chú |
| --- | --- | --- | --- |
| `uri` | `string` | Một tệp trong thư mục cache | URI `file://` cho bản ghi. Chỉ dùng cho bản ghi có một đoạn; xem [Đoạn ghi](/vi/guide/segments#where-files-go). |
| `format` | `'m4a' \| 'aac' \| 'wav' \| 'opus'` | `'m4a'` | Xem [Định dạng](/vi/guide/export#formats). |
| `sampleRate` | `number` | `44100` | Tính bằng Hz. |
| `channels` | `1 \| 2` | `1` | |
| `bitrate` | `number` | `128000` | Bit mỗi giây. Bỏ qua với `wav`. Trên Android bị giới hạn theo `quality`. |
| `quality` | `'low' \| 'medium' \| 'high'` | `'high'` | Chất lượng encoder trên iOS, khoảng bitrate trên Android. |

## Giới hạn và nhịp đo {#recording-limits}

| Prop | Kiểu | Mặc định | Ghi chú |
| --- | --- | --- | --- |
| `maxDurationMs` | `number` | `0` | Tự dừng khi đạt mốc: `onMaxDurationReached` được gọi, rồi đến `onComplete`. `0` là không giới hạn. |
| `minDurationMs` | `number` | `0` | Nếu gọi `stop()` khi bản ghi ngắn hơn mức này, bản ghi sẽ **bị bỏ**: trạng thái về `idle` và `onError` được gọi với code `'min-duration'`. |
| `meterUpdatesPerSecond` | `number` | `30` | Tần suất đọc mức âm và gọi `onMeter`. Giới hạn trong khoảng 1 đến 120. |
| `samplesPerSecond` | `number` | `12` | Số cột thêm vào mỗi giây. Cột được thêm vào ở một nhịp đo mức âm, nên không thể vượt `meterUpdatesPerSecond`. |

## Cột {#bars}

| Prop | Kiểu | Mặc định | Ghi chú |
| --- | --- | --- | --- |
| `playedBarColor` | `ColorValue` | trắng | Màu cột khi đang ghi, và phần đã phát khi nghe lại. |
| `unplayedBarColor` | `ColorValue` | trắng, độ mờ 50% | Phần chưa phát khi nghe lại. |
| `futureBarColor` | `ColorValue` | `unplayedBarColor`, trong hơn | Màu của các vạch giữ chỗ `futureBarStyle`. |
| `barWidth` | `number` | `3` | Tính bằng dp hoặc point. |
| `barGap` | `number` | `2` | Tính bằng dp hoặc point. |
| `barRadius` | `number` | `-1` | Bo góc. Số âm nghĩa là `barWidth / 2`. |
| `futureBarStyle` | `'hidden' \| 'dot' \| 'line'` | `'hidden'` | Thứ lấp vào các ô trống bên trái trước khi cột chạy tới. |
| `recordingMode` | `'scroll' \| 'morph' \| 'centered'` | `'scroll'` | Mới chỉ có `'scroll'`. Các giá trị còn lại hiển thị giống `'scroll'`. |
| `newSampleEntry` | `'grow' \| 'fade' \| 'none'` | `'grow'` | Hiện tại mọi giá trị đều dùng hiệu ứng mọc lên. |

## Khung và đồng hồ {#pill-and-timer}

| Prop | Kiểu | Mặc định | Ghi chú |
| --- | --- | --- | --- |
| `containerBackgroundColor` | `ColorValue` | `#3478F6` | Nền của khung. |
| `containerBorderRadius` | `number` | `16` | |
| `showBackground` | `boolean` | `true` | Đặt `false` để chỉ vẽ cột và đồng hồ lên nền của riêng bạn. |
| `showTime` | `boolean` | `true` | Nhãn `m:ss` bên phải. |
| `timeColor` | `ColorValue` | trắng | |
| `timeMode` | `'count-up' \| 'count-down'` | `'count-up'` | `'count-down'` hiển thị thời gian còn lại tới `maxDurationMs` khi đang ghi, và thời gian còn lại của tệp khi nghe lại. Nếu không có `maxDurationMs` thì vẫn đếm lên khi đang ghi. |

Màu mặc định là cột trắng trên khung xanh. Nếu đặt `showBackground={false}` trên màn hình sáng, hãy đổi luôn `playedBarColor`, `unplayedBarColor` và `timeColor`.

## Nghe lại {#preview}

| Prop | Kiểu | Mặc định | Ghi chú |
| --- | --- | --- | --- |
| `enablePreview` | `boolean` | `true` | Khi là `false`, `enterPreview()` gọi `onError` với code `'preview-disabled'`. |
| `enableContinueRecording` | `boolean` | `true` | Khi là `false`, `resume()` từ chế độ nghe lại gọi `onError` với code `'continue-disabled'`. |
| `showPlayButton` | `boolean` | `true` | Nút phát và tạm dừng trong khung khi nghe lại. |
| `playButtonColor` | `ColorValue` | trắng | |

## Cử chỉ {#gestures}

| Prop | Kiểu | Mặc định | Ghi chú |
| --- | --- | --- | --- |
| `enableSlideToCancel` | `boolean` | `false` | Gọi `onSlideCancel` sau khi kéo sang trái. Bạn tự gọi `cancel()`. |
| `slideToCancelThresholdDp` | `number` | `80` | Khoảng cách ngang, tính bằng dp hoặc point. |
| `enableSlideToLock` | `boolean` | `false` | Gọi `onSlideLock` sau khi kéo lên. |
| `slideToLockThresholdDp` | `number` | `80` | Khoảng cách dọc, tính bằng dp hoặc point. |

Xem [Cử chỉ trượt](/vi/guide/gestures).

## Luồng PCM {#pcm-stream}

| Prop | Kiểu | Mặc định | Ghi chú |
| --- | --- | --- | --- |
| `enablePcmStream` | `boolean` | `false` | Gọi `onPcmChunk` trong lúc ghi. Chỉ dùng được với `output.format = 'wav'`. |
| `pcmChunkMs` | `number` | `200` | Độ dài gần đúng của mỗi chunk, tính bằng ms, tối thiểu 20. |

Xem [Luồng PCM](/vi/guide/pcm-stream).

## Ghi âm khi chạy nền {#background-recording}

| Prop | Kiểu | Mặc định | Ghi chú |
| --- | --- | --- | --- |
| `backgroundRecording` | `boolean` | `false` | Cần thiết lập native, xem [Cài đặt](/vi/guide/installation#background-recording). |
| `backgroundNotificationTitle` | `string` | `'Recording'` | Chỉ Android. |
| `backgroundNotificationBody` | `string` | `'Microphone recording in progress.'` | Chỉ Android. |

## Phát hiện khoảng lặng {#silence-detection}

| Prop | Kiểu | Mặc định | Ghi chú |
| --- | --- | --- | --- |
| `silenceThresholdDb` | `number` | `-160` | Mức dBFS mà dưới đó âm thanh được coi là im lặng. Giá trị mặc định không bao giờ kích hoạt. |
| `silenceTimeoutMs` | `number` | `0` | Thời gian mức âm phải nằm dưới ngưỡng. `0` là tắt tính năng. |
| `autoStopOnSilence` | `boolean` | `false` | Dừng và hoàn tất bản ghi khi phát hiện khoảng lặng. |

Đặt cả `silenceThresholdDb` lẫn `silenceTimeoutMs` để bật tính năng. Xem [Phát hiện khoảng lặng](/vi/guide/silence-detection).

## Trạng thái có kiểm soát {#controlled-state}

`state` là chế độ controlled đang thử nghiệm. Khi đặt prop này, các phương thức của ref không còn chuyển trạng thái nữa mà chỉ báo trạng thái được yêu cầu qua `onStateChange`, và việc đổi prop cũng không bắt đầu hay dừng ghi âm. Hãy để trống prop này và dùng [các phương thức của ref](/vi/guide/ref-methods).
