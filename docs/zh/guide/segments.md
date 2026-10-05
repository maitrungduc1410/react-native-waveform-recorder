---
description: "react-native-waveform-recorder 中暂停、继续、预览和预览后继续录音的工作方式，分段如何合并，以及录音文件写到哪里。"
---

# 分段、暂停与预览 {#segments}

一次录音会话在完成之前可以暂停、回放，然后继续录音。本页说明各个状态、什么时候开始新分段，以及最终写入磁盘的是什么。

## 状态 {#states}

```
idle ──start()──▶ recording ──stop()──▶ stopped ──▶ onComplete
                   │     ▲
           pause() │     │ resume() / start()
                   ▼     │
                  paused ──────stop()──────▶ stopped
                   │  ▲
    enterPreview() │  │ exitPreview()
                   ▼  │
                  preview ──resume()──▶ recording（新分段）
                     └──────stop()──────▶ stopped
```

`enterPreview()` 也可以在 `recording` 状态下调用，它会先暂停。`cancel()` 在任何状态下都会回到 `idle`。录音器无法启动或继续时会报告 `'error'`。

| 状态 | 正在发生什么 |
| --- | --- |
| `idle` | 还没有录音，或会话已被取消。 |
| `recording` | 麦克风开启，正在绘制波形条并触发 `onMeter`。 |
| `paused` | 录音已暂停。`exitPreview()` 之后也会报告此状态。 |
| `preview` | 目前录到的内容已加载到内置播放器。 |
| `stopped` | 文件已完成，`onComplete` 已触发。 |
| `error` | 启动或继续失败，详情见 `onError`。 |

## 暂停与继续 {#pause-and-resume}

在两个平台上，`pause()` 和 `resume()` 都会继续写入**同一个文件**。计时和 `durationMs` 不包括暂停的时间。暂停期间波形条保持不动。

## 预览 {#preview}

`enterPreview()` 会结束当前分段，并把目前录到的全部内容加载到内置播放器。此时视图会显示播放按钮（除非 `showPlayButton={false}`），整条录音的波形条被压缩到视图宽度内，计时显示播放位置。

- 点击播放按钮或调用 `togglePreviewPlayback()` 来播放或暂停。
- 在波形条上拖动来定位，松手时触发 `onSeek`。
- 用 `seekPreview(positionMs)` 在代码中定位。
- 音频播放时，`onPlaybackTimeUpdate` 每秒触发约 30 次。

在 iOS 上，拖动定位使用手势识别器，能够优先于 React Navigation 的侧滑返回手势。在 Android 上，拖动期间视图会请求父视图不要拦截触摸事件。

如果还没有录到任何内容，`enterPreview()` 会触发 code 为 `'preview-snapshot'` 的 `onError`。设置 `enablePreview={false}` 时 code 为 `'preview-disabled'`。

## 预览后继续录音 {#continue-recording}

在预览状态下有三种选择：

| 调用 | 结果 |
| --- | --- |
| `resume()` | 停止播放器并开始录制一个**新分段**。波形条从录音结束的位置接着显示。 |
| `exitPreview()` | 回到 `paused`。之后的 `resume()` 或 `start()` 同样会开始新分段。 |
| `stop()` | 不再继续录音，直接完成。 |

设置 `enableContinueRecording={false}` 时，在预览中调用 `resume()` 会触发 code 为 `'continue-disabled'` 的 `onError`，状态不变。`exitPreview()` 和 `stop()` 仍然可用。

## 合并分段 {#joining-segments}

调用 `stop()` 时，包含多个分段的录音会先合并成一个文件，再触发 `onComplete`：

| 格式 | iOS | Android |
| --- | --- | --- |
| `wav` | 追加 PCM 数据，重写文件头 | 追加 PCM 数据，重写文件头 |
| `m4a`、`aac` | `AVAssetExportSession`，Apple M4A 预设 | `MediaMuxer`，不重新编码 |
| `opus` | `AVAssetExportSession`，passthrough | `MediaMuxer`，不重新编码 |

如果合并失败，会触发 code 为 `'concat'` 的 `onError`，`onComplete` 仍会带着第一个分段触发，让用户至少保留一部分音频。

合并 `wav` 分段时会把它们全部读入内存。很长的、经过预览后继续录音的 `wav` 录音可能占用大量内存，在 iOS 上尤其明显。长时间录音建议使用 `m4a`。

## 文件写在哪里 {#where-files-go}

| 录音 | 文件 |
| --- | --- |
| 单个分段（没有预览后继续录音） | 如果设置了 `output.uri` 就写到那里，否则是应用缓存目录中一个新的 `wfr_*` 文件。 |
| 多个分段 | 第 1 段按上面的规则写入，后续分段放在它旁边，带 `_seg2`、`_seg3`……后缀。合并结果是缓存目录中一个新的 `wfr_concat_*` 文件，所以 `output.uri` 不是最终文件。 |
| 多个分段的预览 | 缓存目录中的临时合并文件，退出预览时删除。 |

`output.uri` 必须是 `file://` URI。Android 也接受普通路径，iOS 不接受。

系统可能会清理缓存目录。请把最终文件移到持久位置，并且要在调用 `cancel()` 或卸载视图之前完成，因为这两者都会删除本次会话的分段文件。参阅[保存文件](/zh/guide/export#keep-the-file)。
