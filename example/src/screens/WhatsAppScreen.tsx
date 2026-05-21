import { useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ColorValue,
} from 'react-native';
import {
  WaveformRecorderView,
  type WaveformRecorderState,
  type WaveformRecorderViewRef,
} from 'react-native-waveform-recorder';
import { ScreenContainer } from '../components/ScreenContainer';
import {
  SentVoiceNote,
  useSentVoiceNotes,
  type VoiceNote,
} from '../components/SentVoiceNote';

const COLORS = {
  bg: '#0b141a',
  chatBg: '#0f1a20',
  bubbleIn: '#1f2c33',
  bubbleOut: '#005c4b',
  inputBar: '#1f2c33',
  text: '#e9edef',
  textDim: '#8696a0',
  green: '#00a884',
  red: '#f15c6d',
  white: '#ffffff',
} as const;

type RecorderState = WaveformRecorderState;

/**
 * WhatsApp-style chat composer recipe.
 *
 * Recipe features:
 *   * Idle: text input + mic icon (tap = `start()`).
 *   * Recording: cancel button (X) + live waveform + pause + send.
 *   * Paused / preview: trash | preview pill | red mic (continue) | send.
 *     Tapping the mic again resumes recording (multi-segment).
 *   * Preview play/pause + scrub built into the recorder view itself.
 *
 * The recorder view is mounted **once** at a stable position in the tree —
 * `display: 'none'` only hides its row in idle state. That keeps the ref
 * alive so the mic button on the idle bar can call `start()` and the
 * native engine can transition the same view into recording mode.
 * Previously the recorder was conditionally mounted only after `state`
 * left `idle`, which left `ref.current` null when the user first tapped
 * the mic — the bug surfaced as a dead record button on every recipe.
 */
export default function WhatsAppScreen() {
  const ref = useRef<WaveformRecorderViewRef>(null);
  const [state, setState] = useState<RecorderState>('idle');
  const [, setDuration] = useState(0);
  const { notes: sentVoiceNotes, add: addSentVoiceNote } = useSentVoiceNotes();

  const isIdle = state === 'idle' || state === 'stopped';
  const isPreviewLike = state === 'paused' || state === 'preview';

  const startRecording = () => ref.current?.start();
  const stopAndSend = () => ref.current?.stop();
  const cancel = () => ref.current?.cancel();
  const pauseToPreview = () => {
    ref.current?.pause();
    // Hop into preview after the engine finalises the segment.
    setTimeout(() => ref.current?.enterPreview(), 60);
  };
  const continueFromPreview = () => ref.current?.resume();

  return (
    <ScreenContainer style={styles.root}>
      <FakeChat sentVoiceNotes={sentVoiceNotes} />
      <View style={styles.composer}>
        {isIdle ? <IdleBar onMic={startRecording} /> : null}

        <View style={[styles.recordingBar, isIdle ? styles.hiddenRow : null]}>
          <Pressable onPress={cancel} hitSlop={8} style={styles.iconButton}>
            <Text style={styles.iconGlyph}>{isPreviewLike ? '🗑' : '✕'}</Text>
          </Pressable>

          <View style={styles.recorderWrap}>
            <WaveformRecorderView
              ref={ref}
              style={styles.bar}
              containerBackgroundColor={COLORS.inputBar as ColorValue}
              playedBarColor={COLORS.white as ColorValue}
              unplayedBarColor="rgba(255,255,255,0.35)"
              playButtonColor={COLORS.white as ColorValue}
              showTime
              timeColor={COLORS.white as ColorValue}
              maxDurationMs={5 * 60 * 1000}
              enableContinueRecording
              onStateChange={(e) => {
                setState(e.state);
                setDuration(e.durationMs);
              }}
              onComplete={addSentVoiceNote}
              onError={(e) =>
                Alert.alert('Recorder error', e.message ?? 'unknown')
              }
            />
          </View>

          <Pressable
            onPress={isPreviewLike ? continueFromPreview : pauseToPreview}
            hitSlop={8}
            style={[
              styles.iconButton,
              isPreviewLike ? styles.continueButton : styles.iconAccent,
            ]}
          >
            <Text style={[styles.iconGlyph, { color: COLORS.white }]}>
              {isPreviewLike ? '●' : '⏸︎'}
            </Text>
          </Pressable>

          <Pressable
            onPress={stopAndSend}
            hitSlop={8}
            style={[styles.iconButton, styles.sendButton]}
          >
            <Text style={[styles.iconGlyph, { color: COLORS.white }]}>➤</Text>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}

// region Composer sub-views -------------------------------------------------

function IdleBar({ onMic }: { onMic: () => void }) {
  return (
    <View style={styles.idleBar}>
      <View style={styles.fakeInput}>
        <Text style={styles.fakeInputPlaceholder}>Message</Text>
      </View>
      <Pressable
        onPress={onMic}
        style={({ pressed }) => [
          styles.micButton,
          { opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Text style={styles.micGlyph}>🎙</Text>
      </Pressable>
    </View>
  );
}

function FakeChat({ sentVoiceNotes }: { sentVoiceNotes: VoiceNote[] }) {
  return (
    <ScrollView style={styles.chat} contentContainerStyle={styles.chatContent}>
      <Text style={styles.dayLabel}>TODAY</Text>
      <Bubble
        side="in"
        text="hey, can you send me that audio?"
        time="9:24 AM"
      />
      <Bubble side="out" text="sure, one sec 🎙" time="9:24 AM" />
      <Bubble side="in" text="🙏" time="9:25 AM" />
      {sentVoiceNotes.length === 0 ? (
        <Bubble side="out" text="recording now…" time="9:26 AM" />
      ) : null}
      {sentVoiceNotes.map((note) => (
        <VoiceBubble key={note.id} note={note} />
      ))}
    </ScrollView>
  );
}

/**
 * Out-bubble that swaps the text body for `AudioWaveformView` from
 * `react-native-waveform-player`. This is the pairing showcase: the
 * recorder writes a tmp m4a + emits a 64-bucket peaks array, which we
 * feed straight into the player so the playback bubble paints with no
 * decode round-trip.
 *
 * NOTE: we deliberately do NOT compose this with `styles.bubble` /
 * `styles.bubbleOut` like the text bubbles do. Those rely on
 * content-sized width + `alignSelf: 'flex-end'`, which gives Fabric
 * native children (the player) an indeterminate width — the bubble
 * paints, but the inner `AudioWaveformView` shows up as 0×N empty.
 * Instead we put the bubble inside a row container with a real width
 * context (`alignItems: 'flex-end'`) and give the bubble itself a
 * percentage width, mirroring the Messenger recipe layout.
 */
function VoiceBubble({ note }: { note: VoiceNote }) {
  return (
    <View style={styles.voiceBubbleRow}>
      <View style={styles.voiceBubble}>
        <SentVoiceNote
          note={note}
          theme={{
            containerBackgroundColor: COLORS.bubbleOut as ColorValue,
            playedBarColor: COLORS.white as ColorValue,
            unplayedBarColor: 'rgba(255,255,255,0.4)',
            foregroundColor: COLORS.white as ColorValue,
          }}
          containerBorderRadius={14}
          style={styles.voiceWaveform}
        />
        <Text style={styles.voiceBubbleTime}>
          {formatDuration(note.durationMs)} ·{' '}
          {(note.sizeBytes / 1024).toFixed(1)} KB
        </Text>
      </View>
    </View>
  );
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function Bubble({
  side,
  text,
  time,
}: {
  side: 'in' | 'out';
  text: string;
  time: string;
}) {
  return (
    <View
      style={[
        styles.bubble,
        side === 'in' ? styles.bubbleIn : styles.bubbleOut,
      ]}
    >
      <Text style={styles.bubbleText}>{text}</Text>
      <Text style={styles.bubbleTime}>{time}</Text>
    </View>
  );
}

// endregion

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  chat: {
    flex: 1,
  },
  chatContent: {
    padding: 16,
    paddingBottom: 24,
  },
  dayLabel: {
    color: COLORS.textDim,
    alignSelf: 'center',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: COLORS.chatBg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 12,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 10,
    padding: 10,
    marginVertical: 4,
  },
  bubbleIn: {
    backgroundColor: COLORS.bubbleIn,
    alignSelf: 'flex-start',
  },
  bubbleOut: {
    backgroundColor: COLORS.bubbleOut,
    alignSelf: 'flex-end',
  },
  bubbleText: {
    color: COLORS.text,
    fontSize: 14,
  },
  bubbleTime: {
    color: COLORS.textDim,
    fontSize: 10,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  /**
   * Row that anchors the voice bubble to the right edge of the chat
   * column. The row itself takes the full chat width (column flex →
   * stretch), giving the inner bubble a defined width context that the
   * percentage-width player can resolve against.
   */
  voiceBubbleRow: { alignItems: 'flex-end', marginVertical: 4 },
  /**
   * Voice-note "out" bubble. Uses an explicit `width: '85%'` (not
   * content-based sizing) precisely so the inner `AudioWaveformView`
   * inherits a real pixel width through `width: '100%'`. We do NOT
   * compose this with `styles.bubble` / `styles.bubbleOut` — see
   * `VoiceBubble` for the why.
   */
  voiceBubble: {
    width: '85%',
    backgroundColor: COLORS.bubbleOut,
    borderRadius: 10,
    padding: 4,
    paddingBottom: 6,
  },
  voiceWaveform: { width: '100%' },
  voiceBubbleTime: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    alignSelf: 'flex-end',
    paddingHorizontal: 6,
    paddingTop: 4,
  },
  composer: {
    padding: 8,
    backgroundColor: COLORS.bg,
  },
  idleBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fakeInput: {
    flex: 1,
    backgroundColor: COLORS.inputBar,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  fakeInputPlaceholder: {
    color: COLORS.textDim,
    fontSize: 15,
  },
  micButton: {
    marginLeft: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micGlyph: {
    color: COLORS.white,
    fontSize: 22,
  },
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  /**
   * Used while idle: parks the recording row off-screen *without*
   * unmounting it, so `ref.current` stays valid for `start()`.
   *
   * We can't use `display: 'none'` here — on iOS Fabric, that removes
   * the underlying UIView from the hierarchy, which nulls out the
   * imperative ref and silently swallows commands. Absolute + huge
   * negative offset keeps the native view mounted and addressable.
   */
  hiddenRow: {
    position: 'absolute',
    left: -100000,
    top: 0,
    opacity: 0,
  },
  recorderWrap: {
    flex: 1,
    marginHorizontal: 6,
  },
  bar: {
    height: 44,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.inputBar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconAccent: {
    backgroundColor: COLORS.green,
  },
  iconGlyph: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  sendButton: {
    backgroundColor: COLORS.green,
    marginLeft: 6,
  },
  continueButton: {
    backgroundColor: COLORS.red,
    marginLeft: 6,
  },
  toast: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 8,
  },
  toastText: {
    color: COLORS.white,
    fontSize: 12,
  },
});
