---
description: "react-native-waveform-recorder 概览：带原生实时波形的 Fabric 录音视图，支持预览、滑动手势、静音检测和 64 条波形导出。"
---

# 什么是 react-native-waveform-recorder？ {#what-is-it}

`react-native-waveform-recorder` 是一个 React Native 视图，它从麦克风录音，并在录音的同时绘制实时波形。它负责语音消息功能中“录”的那一半：用户录音，可以先回放再接着录，你最终拿到一个完整的音频文件，以及一份由 64 条波形组成的音量摘要，用来显示在聊天气泡里。

所有逐帧运行的工作都在原生端完成。麦克风电平由 Swift（`AVAudioRecorder`）和 Kotlin（`MediaRecorder` 或 `AudioRecord`）读取，波形条由原生视图绘制。JavaScript 只通过 [ref](/zh/guide/ref-methods) 发送命令并接收[事件](/zh/guide/events)。

## 功能 {#features}

| 功能 | 参阅 |
| --- | --- |
| 实时波形，可配置波形条、颜色、计时和占位标记 | [属性](/zh/guide/props) |
| 暂停与继续、带拖动定位的预览、预览后继续录音 | [分段、暂停与预览](/zh/guide/segments) |
| 左滑取消和上滑锁定 | [滑动手势](/zh/guide/gestures) |
| 安静一段时间后触发事件，可选自动停止 | [静音检测](/zh/guide/silence-detection) |
| 输出 `m4a`、`aac`、`wav` 和 `opus`，并提供 64 条波形用于聊天气泡 | [导出数据与播放器](/zh/guide/export) |
| 录音时输出 16 位 PCM 数据块 | [PCM 流](/zh/guide/pcm-stream) |
| 后台录音 | [平台说明](/zh/guide/platform-notes#background-recording) |

## 平台 {#platforms}

| | 支持情况 |
| --- | --- |
| iOS | 支持（Swift、AVFoundation）。最低版本跟随你使用的 React Native 版本。 |
| Android | 支持（Kotlin），API 24 及以上。`opus` 格式需要 API 29。 |
| 新架构（Fabric） | 必需。没有旧架构实现。 |
| Expo | 开发构建和 `expo prebuild`，提供配置插件。不支持 Expo Go。 |
| Web | 不支持。在 Web 上渲染该视图会抛出错误。 |

除 React Native 本身外，本库没有任何 JavaScript 依赖。

## 整体流程 {#how-it-fits-together}

1. 渲染 `<WaveformRecorderView>`，并在 `style` 中设置高度，例如 `height: 56`。
2. 在录音按钮里调用 `ref.current?.start()`。本库会先申请麦克风权限。
3. 录音过程中，视图绘制波形条并触发 `onMeter`。你可以调用 `pause()`、`resume()`，调用 `enterPreview()` 回放，或调用 `cancel()`。
4. 调用 `stop()`。视图完成文件写入，并触发 `onComplete`，带上 `file://` URI、时长、大小、格式和 64 个 `samples`。
5. 用 [react-native-waveform-player](https://maitrungduc1410.github.io/react-native-waveform-player/) 展示结果，传入 URI 和 `samples`。

::: warning 取消或卸载前先保存文件
`cancel()` 以及把视图从屏幕上移除，都会删除本次录音会话的文件。如果录音没有经过“预览后继续录音”这一步，被删除的文件就包括 `onComplete` 交给你的那个文件。如果之后还要用，请在 `onComplete` 中复制或移动文件。参阅[导出数据与播放器](/zh/guide/export#keep-the-file)。
:::

## 下一步 {#next-steps}

- [安装](/zh/guide/installation)：权限、后台录音和 Expo 配置插件。
- [快速开始](/zh/guide/quick-start)：一个可以录音、预览和发送的完整页面。
- [浏览器演示](/zh/guide/demo)：用你自己的麦克风试用属性和事件。
