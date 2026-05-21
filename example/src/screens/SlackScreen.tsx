import { useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  bg: '#1a1d21',
  surface: '#222529',
  text: '#e8e8e8',
  textDim: '#9aa0a6',
  green: '#007a5a',
  red: '#e01e5a',
  border: '#3a3d42',
  white: '#fff',
} as const;

/**
 * Slack-style recipe.
 *
 * Compact composer pill in-line with the rich-text input. No preview —
 * the user records, hits the green check, and the audio is sent
 * immediately. Keyboard stays open the whole time (we don't unmount the
 * input across states).
 *
 * Persistent-recorder pattern: the [WaveformRecorderView] is mounted
 * once and hidden via `display: 'none'` when not recording, so the
 * toolbar's mic button (rendered while idle) always has a live ref to
 * call `start()` on.
 */
export default function SlackScreen() {
  const ref = useRef<WaveformRecorderViewRef>(null);
  const [state, setState] = useState<WaveformRecorderState>('idle');
  const { notes: sentVoiceNotes, add: addSentVoiceNote } = useSentVoiceNotes();

  const isRecording = state === 'recording';

  return (
    <ScreenContainer style={styles.root}>
      <ChannelThread voiceNotes={sentVoiceNotes} />
      <View style={styles.composer}>
        <View style={styles.toolbar}>
          <ToolbarBtn label="B" />
          <ToolbarBtn label="I" />
          <ToolbarBtn label="@" />
          <ToolbarBtn label="#" />
          <ToolbarBtn label="🔗" />
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={() =>
              isRecording ? ref.current?.cancel() : ref.current?.start()
            }
            style={[
              styles.micBtn,
              isRecording
                ? { backgroundColor: COLORS.red as ColorValue }
                : null,
            ]}
          >
            <Text style={styles.micGlyph}>{isRecording ? '✕' : '🎙'}</Text>
          </Pressable>
        </View>

        {!isRecording ? (
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="Message #general"
              placeholderTextColor={COLORS.textDim}
              multiline
            />
          </View>
        ) : null}

        <View style={[styles.recordRow, !isRecording && styles.hiddenRow]}>
          <Pressable
            onPress={() => ref.current?.cancel()}
            style={[styles.smallCircle, { backgroundColor: COLORS.surface }]}
          >
            <Text style={styles.smallGlyph}>✕</Text>
          </Pressable>
          <View style={styles.recorderWrap}>
            <WaveformRecorderView
              ref={ref}
              style={styles.bar}
              containerBackgroundColor={COLORS.surface as ColorValue}
              playedBarColor={COLORS.green as ColorValue}
              unplayedBarColor="rgba(255,255,255,0.3)"
              showTime
              timeColor={COLORS.text as ColorValue}
              enablePreview={false}
              enableContinueRecording={false}
              onStateChange={(e) => setState(e.state)}
              onComplete={addSentVoiceNote}
            />
          </View>
          <Pressable
            onPress={() => ref.current?.stop()}
            style={[styles.smallCircle, { backgroundColor: COLORS.green }]}
          >
            <Text style={[styles.smallGlyph, { color: COLORS.white }]}>✓</Text>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}

function ToolbarBtn({ label }: { label: string }) {
  return (
    <View style={styles.toolbarBtn}>
      <Text style={styles.toolbarBtnLabel}>{label}</Text>
    </View>
  );
}

/**
 * Fake `#general` thread. After the user records and sends, an "out"
 * voice-note message is appended here using `AudioWaveformView` from
 * `react-native-waveform-player` — same file URI and 64-bucket peaks
 * the recorder just emitted, no decode round-trip.
 */
function ChannelThread({ voiceNotes }: { voiceNotes: VoiceNote[] }) {
  return (
    <ScrollView
      style={styles.thread}
      contentContainerStyle={styles.threadInner}
    >
      <ChannelHeading />
      {voiceNotes.length === 0 ? (
        <Text style={styles.emptyHint}>
          Send a voice note — it will appear here as a playable message.
        </Text>
      ) : (
        voiceNotes.map((note, i) => (
          <ChannelMessage key={note.id} note={note} index={i} />
        ))
      )}
    </ScrollView>
  );
}

function ChannelHeading() {
  return (
    <View style={styles.channelHeading}>
      <Text style={styles.channelName}># general</Text>
      <Text style={styles.channelSub}>Slack-style recipe</Text>
    </View>
  );
}

function ChannelMessage({ note, index }: { note: VoiceNote; index: number }) {
  return (
    <View style={styles.messageRow}>
      <View style={styles.avatar}>
        <Text style={styles.avatarLabel}>You</Text>
      </View>
      <View style={styles.messageBody}>
        <Text style={styles.messageMeta}>You · Voice memo #{index + 1}</Text>
        <SentVoiceNote
          note={note}
          theme={{
            containerBackgroundColor: COLORS.green as ColorValue,
            playedBarColor: COLORS.white as ColorValue,
            unplayedBarColor: 'rgba(255,255,255,0.4)',
            foregroundColor: COLORS.white as ColorValue,
          }}
          containerBorderRadius={12}
          style={styles.messagePlayer}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  composer: {
    margin: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    overflow: 'hidden',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  toolbarBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginHorizontal: 2,
    borderRadius: 4,
  },
  toolbarBtnLabel: { color: COLORS.text, fontWeight: '700' },
  inputWrap: { padding: 8, minHeight: 80 },
  input: {
    color: COLORS.text,
    fontSize: 15,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  /** Used while not recording. Keeps the recorder mounted off-layout. */
  /** Off-screen instead of `display: 'none'` so the iOS Fabric ref survives. */
  hiddenRow: {
    position: 'absolute',
    left: -100000,
    top: 0,
    opacity: 0,
  },
  recorderWrap: { flex: 1, marginHorizontal: 8 },
  bar: { height: 40 },
  smallCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallGlyph: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  micBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micGlyph: { color: COLORS.white, fontSize: 16 },
  thread: { flex: 1 },
  threadInner: { padding: 12, paddingTop: 16 },
  channelHeading: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 10,
    marginBottom: 8,
  },
  channelName: { color: COLORS.text, fontWeight: '800', fontSize: 16 },
  channelSub: { color: COLORS.textDim, fontSize: 12, marginTop: 2 },
  emptyHint: { color: COLORS.textDim, fontSize: 13, marginTop: 18 },
  messageRow: { flexDirection: 'row', marginTop: 12 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: COLORS.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarLabel: { color: COLORS.white, fontWeight: '800', fontSize: 11 },
  messageBody: { flex: 1 },
  messageMeta: { color: COLORS.textDim, fontSize: 11, marginBottom: 6 },
  messagePlayer: { width: '100%' },
});
