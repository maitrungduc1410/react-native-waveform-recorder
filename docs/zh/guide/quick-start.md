---
description: "用 react-native-waveform-recorder 做一个语音消息页面：录音、暂停、预览、停止、保存文件，并用 react-native-waveform-player 展示。"
---

# 快速开始 {#quick-start}

本页搭建一个简单的语音消息页面：一个带录音、暂停、预览、停止和丢弃按钮的录音视图，以及已发送消息的列表。请先安装本库，参阅[安装](/zh/guide/installation)。

## 渲染录音视图 {#render-the-recorder}

视图没有固有尺寸，需要给它设置高度。保留一个 ref 来调用它的方法。

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
        onPermissionDenied={() => console.warn('麦克风权限被拒绝')}
        onError={(e) => console.warn(e.code, e.message)}
        onComplete={(e) => console.log('已保存', e.uri, e.durationMs)}
      />
      {state === 'recording' ? (
        <Button title="暂停" onPress={() => ref.current?.pause()} />
      ) : (
        <Button title="录音" onPress={() => ref.current?.start()} />
      )}
      <Button title="停止" onPress={() => ref.current?.stop()} />
    </View>
  );
}
```

`start()` 会先申请麦克风权限，然后开始录音。在 `paused` 状态下调用时，它会继续录音。`stop()` 完成文件写入并触发 `onComplete`。

## 加上预览和丢弃 {#add-preview-and-discard}

`enterPreview()` 会暂停录音，并把录音加载到内置播放器中：视图显示播放按钮，用户可以在波形条上拖动来定位。在预览状态下，`resume()` 会录制一个新分段并追加到同一条录音，`stop()` 则结束录音。`cancel()` 丢弃全部内容。

```tsx
{(state === 'recording' || state === 'paused') && (
  <Button title="预览" onPress={() => ref.current?.enterPreview()} />
)}
{state === 'preview' && (
  <Button title="继续录音" onPress={() => ref.current?.resume()} />
)}
{state !== 'idle' && state !== 'stopped' && (
  <Button title="丢弃" onPress={() => ref.current?.cancel()} />
)}
```

完整的状态流转参阅[分段、暂停与预览](/zh/guide/segments)。

## 保存并展示文件 {#keep-the-file-and-show-it}

`onComplete` 会给你一个 `file://` URI 和概括整条录音的 64 条波形。录音文件仍然属于录音会话：`cancel()` 或卸载视图都可能删除它们，所以在使用之前先把文件复制到持久位置。然后用 [react-native-waveform-player](https://maitrungduc1410.github.io/react-native-waveform-player/) 展示：

```tsx
import { AudioWaveformView } from 'react-native-waveform-player';

type Note = { uri: string; samples: number[] };

const [notes, setNotes] = useState<Note[]>([]);

<WaveformRecorderView
  ref={ref}
  style={{ height: 56 }}
  onComplete={async (e) => {
    const uri = await copyToDocuments(e.uri); // 你自己的文件工具函数
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

`copyToDocuments` 代表你的应用已经在用的文件库，例如 `expo-file-system` 或 `react-native-fs`。参阅[导出数据与播放器](/zh/guide/export)。

## 下一步 {#next-steps}

- 使用[滑动手势](/zh/guide/gestures)，让用户在录音视图上拖动来取消或锁定。
- 使用[静音检测](/zh/guide/silence-detection)，在安静一段时间后自动停止。
- 通过 [`output` 属性](/zh/guide/props#output)修改格式、采样率或码率。
