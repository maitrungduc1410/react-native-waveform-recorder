---
description: "onComplete trả về những gì: định dạng tệp và kiểu MIME theo nền tảng, cách tính 64 cột, cách giữ tệp an toàn và phát lại bằng react-native-waveform-player."
---

# Dữ liệu xuất và trình phát {#export}

Khi bản ghi hoàn tất, `onComplete` đưa cho bạn một tệp cùng bản tóm tắt gọn của nó:

```ts
onComplete={(e) => {
  e.uri;           // 'file:///.../wfr_....m4a'
  e.durationMs;    // 7340
  e.format;        // 'm4a'
  e.mimeType;      // 'audio/mp4'
  e.sizeBytes;     // 58123
  e.sampleRate;    // 44100
  e.channels;      // 1
  e.samples;       // 64 số trong [0, 1]
  e.peakAmplitude; // 0.93
}}
```

## Định dạng {#formats}

Chọn định dạng bằng `output.format`. Phần mở rộng của tệp và `mimeType` phụ thuộc vào nền tảng:

| `format` | Tệp trên iOS | `mimeType` trên iOS | Tệp trên Android | `mimeType` trên Android |
| --- | --- | --- | --- | --- |
| `m4a` (mặc định) | AAC trong `.m4a` | `audio/mp4` | AAC trong `.m4a` | `audio/mp4` |
| `aac` | AAC trong `.m4a` | `audio/aac` | AAC trong `.m4a` | `audio/mp4` |
| `wav` | PCM 16-bit `.wav` | `audio/wav` | PCM 16-bit `.wav` | `audio/wav` |
| `opus` | Opus trong `.caf` | `audio/opus` | Opus trong `.ogg` (API 29+) | `audio/ogg` |

- `m4a` là lựa chọn an toàn nhất để chia sẻ và phát ở mọi nơi.
- `aac` ghi ra cùng loại âm thanh với `m4a`. Chỉ có kiểu MIME được báo trên iOS là khác.
- `wav` không nén và có dung lượng lớn. Đây là định dạng duy nhất hỗ trợ [luồng PCM](/vi/guide/pcm-stream).
- `opus` cho tệp nhỏ nhất, nhưng container khác nhau: `.caf` trên iOS khó phát được ngoài các nền tảng của Apple. Trên Android dưới API 29, engine ghi AAC thay thế và gọi `onError` với code `'format-unsupported'`; tệp vẫn mang tên `.ogg` và kiểu `audio/ogg` dù bên trong là AAC.

Trên Android, `output.bitrate` bị giới hạn theo `output.quality`: 32 đến 64 kbps cho `low`, 64 đến 128 kbps cho `medium` và 96 đến 256 kbps cho `high`. Trên iOS, bitrate và quality được truyền nguyên cho encoder.

## Xuất 64 cột {#the-64-bar-export}

`samples` là dạng sóng làm sẵn cho bong bóng chat, nhờ vậy phía nhận không phải giải mã âm thanh. Mảng này được tính ở phía native từ các lần đo mức âm của cả phiên:

1. Các lần đo (mỗi nhịp một lần, `meterUpdatesPerSecond` lần mỗi giây) được chia đều theo thời gian thành 64 nhóm.
2. Mỗi nhóm lấy giá trị căn bậc hai trung bình bình phương (RMS) của các lần đo trong nhóm.
3. Cả 64 giá trị được chia cho giá trị lớn nhất, nên cột to nhất là `1`.

Cần lưu ý:

- Các giá trị là tương đối. Bản ghi nhỏ tiếng hay to tiếng đều có cột đạt `1`. Dùng `peakAmplitude` nếu bạn cần mức tuyệt đối.
- Bản ghi có ít hơn 64 lần đo (dưới khoảng hai giây với mặc định 30 lần mỗi giây) sẽ có nhóm trống, và các cột đó bằng `0`.
- Các lần đo lấy từ mức âm, nên theo cách quy đổi của từng nền tảng (xem [onMeter](/vi/guide/events#onmeter)). Cùng một âm thanh cho hình dạng hơi khác nhau trên iOS và Android.
- Phiên rất dài chỉ giữ tối đa 16.384 lần đo; các lần đo cũ được gộp theo cặp, giữ giá trị to hơn.

## Giữ lại tệp {#keep-the-file}

Tệp ở `onComplete.uri` thường nằm trong thư mục cache của app và vẫn thuộc về phiên ghi:

- `cancel()`, kể cả sau `stop()`, xóa các tệp đoạn ghi của phiên.
- Gỡ view khỏi màn hình cũng vậy: Android dọn dẹp khi view bị drop, iOS khi view được recycle.
- Với bản ghi không qua bước nghe lại rồi ghi tiếp, tệp đoạn ghi **chính là** tệp được trả về.

Vì vậy, trong `onComplete`, hãy di chuyển hoặc sao chép tệp sang nơi lưu lâu dài (ví dụ thư mục documents), hoặc tải lên, trước khi bạn gọi `cancel()`, chuyển màn hình hoặc unmount view ghi âm. Bắt đầu bản ghi mới bằng `start()` không xóa tệp trước đó.

## Phát bằng react-native-waveform-player {#play-it-with-the-player}

[react-native-waveform-player](https://maitrungduc1410.github.io/react-native-waveform-player/) là nửa "phát": cùng kiểu khung, cột và đồng hồ, có phát, tạm dừng, tua và chỉnh tốc độ. Truyền URI và 64 cột vào là trình phát bỏ qua bước giải mã tệp:

```tsx
import { AudioWaveformView } from 'react-native-waveform-player';

<AudioWaveformView
  source={{ uri: note.uri }}
  samples={note.samples}
  style={{ height: 56 }}
/>
```

Hai thư viện độc lập với nhau và không có dependency chung. Nếu gửi tin nhắn thoại cho người khác, hãy gửi kèm `samples` cùng tệp (64 con số chỉ khoảng vài trăm byte JSON), để thiết bị nhận vẽ được bong bóng ngay.
