---
description: "Record voice notes in React Native with a native live waveform, pause and preview, slide-to-cancel and slide-to-lock, silence detection and a 64-bar export."
layout: home

hero:
  name: React Native Waveform Recorder
  text: Voice recording with a live native waveform
  tagline: A Fabric view for iOS and Android that records audio, draws the waveform on the UI thread, previews and continues recordings, and hands you a file plus 64 bars ready for a chat bubble.
  actions:
    - theme: brand
      text: Get started
      link: /guide/quick-start
    - theme: alt
      text: Try it in the browser
      link: /guide/demo
    - theme: alt
      text: API reference
      link: /api/

features:
  - icon: 🎙️
    title: Native live waveform
    details: Bars are drawn natively in Swift and Kotlin from the microphone level. No JavaScript runs per frame.
    link: /guide/props
    linkText: Props
  - icon: ⏯️
    title: Pause, preview, continue
    details: Pause and resume, listen back with scrubbing, then keep recording. Segments are joined into one file on stop.
    link: /guide/segments
    linkText: Segments and preview
  - icon: 👆
    title: Slide to cancel or lock
    details: Drag left to cancel or up to lock, with live progress events to drive your own hints.
    link: /guide/gestures
    linkText: Slide gestures
  - icon: 🤫
    title: Silence detection
    details: Get an event after a quiet stretch, or stop the recording automatically.
    link: /guide/silence-detection
    linkText: Silence detection
  - icon: 📊
    title: 64-bar export
    details: onComplete returns 64 normalised bars you can pass straight to react-native-waveform-player.
    link: /guide/export
    linkText: Export and the player
  - icon: 🔊
    title: Raw PCM stream
    details: Opt in to 16-bit PCM chunks while recording WAV, for speech-to-text or voice activity detection.
    link: /guide/pcm-stream
    linkText: PCM stream
---

<div class="home-section vp-doc">

![The recorder view on iOS: white waveform bars on a blue pill with a 0:07 timer](/demo.png){.demo-shot}

## Install {#install}

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

Then run `npx pod-install` for iOS and add a microphone usage description. See [Installation](/guide/installation) for permissions, background recording and the Expo config plugin.

## Record a voice note {#record-a-voice-note}

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
      <Button title="Record" onPress={() => ref.current?.start()} />
      <Button title="Stop" onPress={() => ref.current?.stop()} />
    </View>
  );
}
```

## Play it back with the sister library {#play-it-back}

[react-native-waveform-player](https://maitrungduc1410.github.io/react-native-waveform-player/) draws the same kind of pill for playback. Pass `onComplete.uri` and `onComplete.samples` to it and the player skips decoding the file. See [Export and the player](/guide/export).

</div>
