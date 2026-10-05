---
description: "Nhận PCM 16-bit thô từ react-native-waveform-recorder khi ghi WAV, giải mã các chunk base64 bằng helper pcm-stream rồi đưa vào speech-to-text hoặc VAD."
---

# Luồng PCM {#pcm-stream}

Trong lúc ghi, view có thể gửi cho bạn âm thanh thô theo từng chunk nhỏ, chẳng hạn để chạy nhận dạng giọng nói hoặc phát hiện giọng nói (VAD) khi người dùng vẫn đang nói.

```tsx
import { WaveformRecorderView } from 'react-native-waveform-recorder';
import {
  decodePcmChunk,
  pcmToMonoFloat32,
} from 'react-native-waveform-recorder/pcm-stream';

<WaveformRecorderView
  ref={ref}
  style={{ height: 56 }}
  output={{ format: 'wav', sampleRate: 16000, channels: 1 }}
  enablePcmStream
  pcmChunkMs={100}
  onPcmChunk={(e) => {
    const int16 = decodePcmChunk(e.chunk);
    const float32 = pcmToMonoFloat32(int16, e.channels);
    vad.push(float32, e.sampleRate);
  }}
/>;
```

## Yêu cầu {#requirements}

- `output.format` phải là `'wav'`. Với định dạng khác, `enablePcmStream` bị bỏ qua và không có chunk nào được gửi.
- Bật `enablePcmStream` trước khi `start()`. Thiết lập này được đọc khi một đoạn ghi bắt đầu.
- Tệp ghi âm vẫn được ghi như bình thường và `onComplete` vẫn được gọi.

## Chunk {#the-chunk}

| Trường | Ý nghĩa |
| --- | --- |
| `chunk` | Chuỗi base64 chứa PCM 16-bit little-endian, các kênh xen kẽ. |
| `sampleRate` | Sample rate tính bằng Hz, lấy từ `output.sampleRate`. |
| `channels` | Số kênh. |
| `bytesPerSample` | Luôn là `2`. |
| `timestampMs` | Thời lượng đã ghi tại lúc gửi chunk, tính bằng ms. |

`pcmChunkMs` (mặc định `200`, tối thiểu `20`) đặt độ dài gần đúng của mỗi chunk:

- **iOS** đọc các byte mới từ tệp WAV mỗi `pcmChunkMs`, tối đa 256 KB mỗi chunk.
- **Android** gom mẫu từ `AudioRecord` cho đến khi đủ khoảng `pcmChunkMs` âm thanh rồi gửi đi. Phần còn lại được gửi khi dừng ghi.

## Helper {#helpers}

Các helper nằm ở subpath `react-native-waveform-recorder/pcm-stream`, nên app không import thì cũng không phải đóng gói chúng.

| Hàm | Làm gì |
| --- | --- |
| `decodePcmChunk(chunk)` | Giải mã payload base64 thành `Int16Array`. Dùng `globalThis.atob` nếu có, nếu không thì dùng bộ giải mã có sẵn. |
| `pcmToMonoFloat32(int16, channels)` | Chuyển Int16 xen kẽ kênh thành `Float32Array` một kênh trong `[-1, 1]`. Cặp stereo được lấy trung bình. |

Xem chữ ký hàm trong [tài liệu API](/api/react-native-waveform-recorder/pcm-stream/).

## Giới hạn {#limits}

- Các chunk đi qua bridge dưới dạng chuỗi base64. Với giọng nói 16 kHz một kênh (32 KB mỗi giây) thì ổn, nhưng nếu cần vài MB mỗi giây, hãy cân nhắc một thư viện âm thanh dùng JSI như [react-native-audio-api](https://github.com/software-mansion/react-native-audio-api).
- Trên iOS, sau `pause()` rồi `resume()`, luồng đọc lại tệp hiện tại từ đầu, nên phần âm thanh đã gửi trước lúc tạm dừng có thể bị gửi lần nữa. Cũng trên iOS, chunk dở dang cuối cùng trước `pause()` hoặc `stop()` không được gửi. Nếu cần chính xác tuyệt đối, hãy lấy tệp WAV cuối cùng từ `onComplete` làm nguồn chuẩn.
- Chunk được gửi trên JavaScript thread. Hãy giữ `onPcmChunk` thật nhẹ và chuyển việc nặng sang worker hoặc module native.
