---
description: "Làm màn hình tin nhắn thoại với react-native-waveform-recorder: ghi, tạm dừng, nghe lại, dừng, giữ tệp và hiển thị bằng react-native-waveform-player."
---

# Bắt đầu nhanh {#quick-start}

Trang này dựng một màn hình tin nhắn thoại nhỏ: một view ghi âm với các nút ghi, tạm dừng, nghe lại, dừng và bỏ, cùng danh sách các tin đã gửi. Hãy cài thư viện trước, xem [Cài đặt](/vi/guide/installation).

## Render view ghi âm {#render-the-recorder}

View không có kích thước tự nhiên, nên bạn cần đặt chiều cao cho nó. Giữ một ref để gọi các phương thức.

```tsx
import { useRef, useState } from 'react';
import { Button, View } from 'react-native';
import {
  WaveformRecorderView,
  type WaveformRecorderState,
  type WaveformRecorderViewRef,
} from 'react-native-waveform-recorder';

export function Composer() {
  const ref = useRef<WaveformRecorderViewRef>(null);
  const [state, setState] = useState<WaveformRecorderState>('idle');

  return (
    <View style={{ padding: 16, gap: 8 }}>
      <WaveformRecorderView
        ref={ref}
        style={{ height: 56 }}
        onStateChange={(e) => setState(e.state)}
        onPermissionDenied={() => console.warn('Người dùng từ chối quyền micro')}
        onError={(e) => console.warn(e.code, e.message)}
        onComplete={(e) => console.log('Đã lưu', e.uri, e.durationMs)}
      />
      {state === 'recording' ? (
        <Button title="Tạm dừng" onPress={() => ref.current?.pause()} />
      ) : (
        <Button title="Ghi âm" onPress={() => ref.current?.start()} />
      )}
      <Button title="Dừng" onPress={() => ref.current?.stop()} />
    </View>
  );
}
```

`start()` xin quyền micro rồi bắt đầu ghi. Nếu gọi khi đang `paused`, nó sẽ ghi tiếp. `stop()` hoàn tất tệp và gọi `onComplete`.

## Thêm nghe lại và bỏ {#add-preview-and-discard}

`enterPreview()` tạm dừng việc ghi và nạp bản ghi vào trình phát có sẵn: view hiện nút phát và người dùng có thể kéo trên các cột để tua. Từ chế độ nghe lại, `resume()` ghi một đoạn mới nối vào cùng bản ghi, còn `stop()` thì kết thúc. `cancel()` bỏ toàn bộ.

```tsx
{(state === 'recording' || state === 'paused') && (
  <Button title="Nghe lại" onPress={() => ref.current?.enterPreview()} />
)}
{state === 'preview' && (
  <Button title="Ghi tiếp" onPress={() => ref.current?.resume()} />
)}
{state !== 'idle' && state !== 'stopped' && (
  <Button title="Bỏ" onPress={() => ref.current?.cancel()} />
)}
```

Xem toàn bộ luồng trạng thái ở [Đoạn ghi, tạm dừng và nghe lại](/vi/guide/segments).

## Giữ tệp và hiển thị {#keep-the-file-and-show-it}

`onComplete` trả về một URI `file://` và 64 cột tóm tắt bản ghi. Các tệp ghi âm vẫn thuộc về phiên ghi: `cancel()` hoặc việc unmount view có thể xóa chúng, nên hãy sao chép tệp sang chỗ lưu lâu dài trước khi dùng. Sau đó hiển thị bằng [react-native-waveform-player](https://maitrungduc1410.github.io/react-native-waveform-player/):

```tsx
import { AudioWaveformView } from 'react-native-waveform-player';

type Note = { uri: string; samples: number[] };

const [notes, setNotes] = useState<Note[]>([]);

<WaveformRecorderView
  ref={ref}
  style={{ height: 56 }}
  onComplete={async (e) => {
    const uri = await copyToDocuments(e.uri); // hàm xử lý tệp của riêng bạn
    setNotes((n) => [...n, { uri, samples: e.samples }]);
  }}
/>

{notes.map((note) => (
  <AudioWaveformView
    key={note.uri}
    source={{ uri: note.uri }}
    samples={note.samples}
    style={{ height: 56 }}
  />
))}
```

`copyToDocuments` là đại diện cho thư viện xử lý tệp mà app bạn đang dùng, chẳng hạn `expo-file-system` hoặc `react-native-fs`. Xem [Dữ liệu xuất và trình phát](/vi/guide/export).

## Bước tiếp theo {#next-steps}

- Cho người dùng kéo trên view ghi âm để hủy hoặc khóa bằng [cử chỉ trượt](/vi/guide/gestures).
- Tự động dừng khi im lặng một lúc bằng [phát hiện khoảng lặng](/vi/guide/silence-detection).
- Đổi định dạng, sample rate hoặc bitrate bằng [prop `output`](/vi/guide/props#output).
