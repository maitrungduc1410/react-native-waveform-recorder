---
description: "Build a voice note screen with react-native-waveform-recorder: record, pause, preview, stop, keep the file and show it with react-native-waveform-player."
---

# Quick start {#quick-start}

This page builds a small voice note screen: a recorder with record, pause, preview, stop and discard buttons, and a list of sent notes. Install the library first, see [Installation](/guide/installation).

## Render the recorder {#render-the-recorder}

The view has no intrinsic size, so give it a height. Keep a ref to call its methods.

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
        onPermissionDenied={() => console.warn('Microphone permission refused')}
        onError={(e) => console.warn(e.code, e.message)}
        onComplete={(e) => console.log('Saved', e.uri, e.durationMs)}
      />
      {state === 'recording' ? (
        <Button title="Pause" onPress={() => ref.current?.pause()} />
      ) : (
        <Button title="Record" onPress={() => ref.current?.start()} />
      )}
      <Button title="Stop" onPress={() => ref.current?.stop()} />
    </View>
  );
}
```

`start()` asks for microphone permission, then starts recording. Called in `paused`, it resumes. `stop()` finalises the file and fires `onComplete`.

## Add preview and discard {#add-preview-and-discard}

`enterPreview()` pauses the recording and loads it into the built-in player: the view shows a play button and the user can drag on the bars to seek. From preview, `resume()` records a new segment that is appended to the same recording, and `stop()` finishes it. `cancel()` throws everything away.

```tsx
{(state === 'recording' || state === 'paused') && (
  <Button title="Preview" onPress={() => ref.current?.enterPreview()} />
)}
{state === 'preview' && (
  <Button title="Continue" onPress={() => ref.current?.resume()} />
)}
{state !== 'idle' && state !== 'stopped' && (
  <Button title="Discard" onPress={() => ref.current?.cancel()} />
)}
```

See [Segments, pause and preview](/guide/segments) for the full state flow.

## Keep the file and show it {#keep-the-file-and-show-it}

`onComplete` gives you a `file://` URI and 64 bars that summarise the recording. The recording files belong to the recorder session: `cancel()` or unmounting the view can delete them, so copy the file somewhere permanent before you rely on it. Then show it with [react-native-waveform-player](https://maitrungduc1410.github.io/react-native-waveform-player/):

```tsx
import { AudioWaveformView } from 'react-native-waveform-player';

type Note = { uri: string; samples: number[] };

const [notes, setNotes] = useState<Note[]>([]);

<WaveformRecorderView
  ref={ref}
  style={{ height: 56 }}
  onComplete={async (e) => {
    const uri = await copyToDocuments(e.uri); // your own file helper
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

`copyToDocuments` stands for whatever file library your app already uses, such as `expo-file-system` or `react-native-fs`. See [Export and the player](/guide/export).

## Next steps {#next-steps}

- Let the user drag on the recorder to cancel or lock with [slide gestures](/guide/gestures).
- Stop automatically after a quiet stretch with [silence detection](/guide/silence-detection).
- Change the format, sample rate or bitrate with the [`output` prop](/guide/props#output).
