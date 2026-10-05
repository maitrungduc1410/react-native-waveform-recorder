---
description: "在 React Native 中录制语音消息：原生实时波形、暂停与预览、左滑取消和上滑锁定、静音检测，以及 64 条波形导出。"
layout: home

hero:
  name: React Native Waveform Recorder
  text: 带原生实时波形的录音组件
  tagline: 一个适用于 iOS 和 Android 的 Fabric 视图：录音、在 UI 线程绘制波形、预览后继续录音，最后交给你音频文件和可直接用于聊天气泡的 64 条波形数据。
  actions:
    - theme: brand
      text: 开始使用
      link: /zh/guide/quick-start
    - theme: alt
      text: 在浏览器中试用
      link: /zh/guide/demo
    - theme: alt
      text: API 参考
      link: /api/

features:
  - icon: 🎙️
    title: 原生实时波形
    details: 波形条由 Swift 和 Kotlin 根据麦克风电平原生绘制，每一帧都不需要运行 JavaScript。
    link: /zh/guide/props
    linkText: 属性
  - icon: ⏯️
    title: 暂停、预览、继续录音
    details: 暂停后继续，回放并拖动定位，然后接着录。停止时各分段会合并成一个文件。
    link: /zh/guide/segments
    linkText: 分段与预览
  - icon: 👆
    title: 左滑取消、上滑锁定
    details: 向左拖动取消，向上拖动锁定，并提供实时进度事件，方便你绘制自己的提示。
    link: /zh/guide/gestures
    linkText: 滑动手势
  - icon: 🤫
    title: 静音检测
    details: 安静一段时间后收到事件，也可以自动停止录音。
    link: /zh/guide/silence-detection
    linkText: 静音检测
  - icon: 📊
    title: 64 条波形导出
    details: onComplete 返回 64 个归一化的值，可以直接传给 react-native-waveform-player。
    link: /zh/guide/export
    linkText: 导出数据与播放器
  - icon: 🔊
    title: 原始 PCM 流
    details: 录制 WAV 时可选择接收 16 位 PCM 数据块，用于语音识别或语音活动检测。
    link: /zh/guide/pcm-stream
    linkText: PCM 流
---

<div class="home-section vp-doc">

![iOS 上的录音视图：蓝色胶囊背景上的白色波形条，计时显示 0:07](/demo.png){.demo-shot}

## 安装 {#install}

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

然后为 iOS 运行 `npx pod-install`，并添加麦克风使用说明。权限、后台录音和 Expo 配置插件请参阅[安装](/zh/guide/installation)。

## 录一条语音消息 {#record-a-voice-note}

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
      <Button title="录音" onPress={() => ref.current?.start()} />
      <Button title="停止" onPress={() => ref.current?.stop()} />
    </View>
  );
}
```

## 用姊妹库播放 {#play-it-back}

[react-native-waveform-player](https://maitrungduc1410.github.io/react-native-waveform-player/) 用同样风格的胶囊视图来播放音频。把 `onComplete.uri` 和 `onComplete.samples` 传给它，播放器就不需要再解码文件。参阅[导出数据与播放器](/zh/guide/export)。

</div>
