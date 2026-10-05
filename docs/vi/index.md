---
description: "Ghi âm tin nhắn thoại trong React Native với dạng sóng native theo thời gian thực, tạm dừng và nghe lại, trượt để hủy hoặc khóa, phát hiện khoảng lặng."
layout: home

hero:
  name: React Native Waveform Recorder
  text: Ghi âm với dạng sóng native theo thời gian thực
  tagline: Một view Fabric cho iOS và Android để ghi âm, vẽ dạng sóng trên UI thread, nghe lại rồi ghi tiếp, và trả về tệp âm thanh kèm 64 cột sẵn sàng cho bong bóng chat.
  actions:
    - theme: brand
      text: Bắt đầu
      link: /vi/guide/quick-start
    - theme: alt
      text: Thử trên trình duyệt
      link: /vi/guide/demo
    - theme: alt
      text: Tài liệu API
      link: /api/

features:
  - icon: 🎙️
    title: Dạng sóng native theo thời gian thực
    details: Các cột được vẽ native bằng Swift và Kotlin từ mức âm của micro. Không có đoạn JavaScript nào chạy theo từng khung hình.
    link: /vi/guide/props
    linkText: Props
  - icon: ⏯️
    title: Tạm dừng, nghe lại, ghi tiếp
    details: Tạm dừng rồi ghi tiếp, nghe lại và tua, sau đó ghi thêm. Khi dừng, các đoạn ghi được nối thành một tệp.
    link: /vi/guide/segments
    linkText: Đoạn ghi và nghe lại
  - icon: 👆
    title: Trượt để hủy hoặc khóa
    details: Kéo sang trái để hủy, kéo lên để khóa, kèm sự kiện tiến độ để bạn tự vẽ gợi ý.
    link: /vi/guide/gestures
    linkText: Cử chỉ trượt
  - icon: 🤫
    title: Phát hiện khoảng lặng
    details: Nhận sự kiện khi người dùng im lặng một lúc, hoặc tự động dừng ghi âm.
    link: /vi/guide/silence-detection
    linkText: Phát hiện khoảng lặng
  - icon: 📊
    title: Xuất 64 cột
    details: onComplete trả về 64 cột đã chuẩn hóa, truyền thẳng vào react-native-waveform-player được.
    link: /vi/guide/export
    linkText: Dữ liệu xuất và trình phát
  - icon: 🔊
    title: Luồng PCM thô
    details: Bật nhận các chunk PCM 16-bit trong lúc ghi WAV, dùng cho speech-to-text hoặc phát hiện giọng nói.
    link: /vi/guide/pcm-stream
    linkText: Luồng PCM
---

<div class="home-section vp-doc">

![View ghi âm trên iOS: các cột dạng sóng màu trắng trên khung màu xanh, đồng hồ hiển thị 0:07](/demo.png){.demo-shot}

## Cài đặt {#install}

::: code-group

```sh [npm]
npm install react-native-waveform-recorder
```

```sh [yarn]
yarn add react-native-waveform-recorder
```

```sh [Expo]
npx expo install react-native-waveform-recorder
npx expo prebuild
```

:::

Sau đó chạy `npx pod-install` cho iOS và thêm mô tả quyền dùng micro. Xem [Cài đặt](/vi/guide/installation) để biết về quyền, ghi âm khi chạy nền và config plugin của Expo.

## Ghi một tin nhắn thoại {#record-a-voice-note}

```tsx
import { useRef } from 'react';
import { Button, View } from 'react-native';
import {
  WaveformRecorderView,
  type WaveformRecorderViewRef,
} from 'react-native-waveform-recorder';

export function VoiceNote() {
  const ref = useRef<WaveformRecorderViewRef>(null);
  return (
    <View>
      <WaveformRecorderView
        ref={ref}
        style={{ height: 56 }}
        onComplete={(e) => console.log(e.uri, e.durationMs, e.samples)}
      />
      <Button title="Ghi âm" onPress={() => ref.current?.start()} />
      <Button title="Dừng" onPress={() => ref.current?.stop()} />
    </View>
  );
}
```

## Phát lại bằng thư viện anh em {#play-it-back}

[react-native-waveform-player](https://maitrungduc1410.github.io/react-native-waveform-player/) vẽ cùng kiểu khung đó để phát lại. Truyền `onComplete.uri` và `onComplete.samples` vào là trình phát bỏ qua bước giải mã tệp. Xem [Dữ liệu xuất và trình phát](/vi/guide/export).

</div>
