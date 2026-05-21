import { useRef, useState } from 'react';
import {
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
  bg: '#f4f6f8',
  surface: '#ffffff',
  text: '#222',
  textDim: '#6b7280',
  blue: '#0068ff',
  red: '#e64a4a',
  green: '#2ecc71',
} as const;

/**
 * Zalo-style recipe.
 *
 * Recording pill on top, then a three-button row below: Delete / Preview
 * / Send. The Preview button transitions the recorder into preview
 * state, where the user can scrub + play, then continue or send.
 *
 * Persistent-recorder pattern: the [WaveformRecorderView] is mounted
 * once and hidden via `display: 'none'` while idle. The "Tap to record"
 * overlay sits on top of the same slot, so its `start()` press lands
 * on a live native view.
 */
export default function ZaloScreen() {
  const ref = useRef<WaveformRecorderViewRef>(null);
  const [state, setState] = useState<WaveformRecorderState>('idle');
  const { notes: sentVoiceNotes, add: addSentVoiceNote } = useSentVoiceNotes();

  const isIdle = state === 'idle' || state === 'stopped';

  return (
    <ScreenContainer style={styles.root}>
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyInner}>
        <Text style={styles.headerTitle}>Zalo recipe</Text>
        <Text style={styles.headerSub}>
          Light-mode pill with explicit Delete / Preview / Send row.
        </Text>
        <SentBubbles voiceNotes={sentVoiceNotes} />
      </ScrollView>

      <View style={styles.composer}>
        <View style={styles.recorderPill}>
          {isIdle ? (
            <Pressable
              style={styles.startBigBtn}
              onPress={() => ref.current?.start()}
            >
              <Text style={styles.startBigBtnLabel}>Tap to record</Text>
            </Pressable>
          ) : null}

          <View style={isIdle ? styles.hiddenRow : null}>
            <WaveformRecorderView
              ref={ref}
              style={styles.bar}
              containerBackgroundColor="#eaf1ff"
              containerBorderRadius={16}
              playedBarColor={COLORS.blue as ColorValue}
              unplayedBarColor="rgba(0,104,255,0.25)"
              showTime
              timeColor={COLORS.blue as ColorValue}
              playButtonColor={COLORS.blue as ColorValue}
              enablePreview
              enableContinueRecording
              onStateChange={(e) => setState(e.state)}
              onComplete={addSentVoiceNote}
            />
          </View>
        </View>

        <View style={styles.actionRow}>
          <ActionBtn
            label="Delete"
            color={COLORS.red as ColorValue}
            disabled={isIdle}
            onPress={() => ref.current?.cancel()}
          />
          <ActionBtn
            label={state === 'preview' ? 'Continue' : 'Preview'}
            color={COLORS.blue as ColorValue}
            disabled={
              state !== 'recording' && state !== 'paused' && state !== 'preview'
            }
            onPress={() => {
              if (state === 'preview') {
                ref.current?.resume();
              } else if (state === 'recording') {
                ref.current?.pause();
                setTimeout(() => ref.current?.enterPreview(), 60);
              } else if (state === 'paused') {
                ref.current?.enterPreview();
              }
            }}
          />
          <ActionBtn
            label="Send"
            color={COLORS.green as ColorValue}
            disabled={state === 'idle'}
            filled
            onPress={() => ref.current?.stop()}
          />
        </View>
      </View>
    </ScreenContainer>
  );
}

/**
 * Light-mode "chat" of voice notes the user has sent in this session.
 * Rendered with `AudioWaveformView` from `react-native-waveform-player`,
 * using the recorder's `onComplete` file URI + 64-bucket peaks — the
 * pairing showcase that motivated this screen.
 */
function SentBubbles({ voiceNotes }: { voiceNotes: VoiceNote[] }) {
  if (voiceNotes.length === 0) return null;
  return (
    <View style={styles.sentList}>
      {voiceNotes.map((note) => (
        <View key={note.id} style={styles.sentRow}>
          <SentVoiceNote
            note={note}
            theme={{
              containerBackgroundColor: '#eaf1ff',
              playedBarColor: COLORS.blue as ColorValue,
              unplayedBarColor: 'rgba(0,104,255,0.25)',
              foregroundColor: COLORS.blue as ColorValue,
              speedColor: COLORS.blue as ColorValue,
              speedBackgroundColor: 'rgba(0,104,255,0.18)',
            }}
            containerBorderRadius={18}
            style={styles.sentPlayer}
          />
        </View>
      ))}
    </View>
  );
}

function ActionBtn({
  label,
  color,
  filled = false,
  disabled = false,
  onPress,
}: {
  label: string;
  color: ColorValue;
  filled?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.actionBtn,
        filled
          ? { backgroundColor: color }
          : { borderColor: color, backgroundColor: '#fff' },
        disabled ? styles.actionBtnDisabled : null,
      ]}
    >
      <Text
        style={[
          styles.actionBtnLabel,
          filled
            ? { color: '#fff' }
            : typeof color === 'string'
              ? { color }
              : { color: '#222' },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  body: { flex: 1 },
  bodyInner: { padding: 16, paddingBottom: 24 },
  headerTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 24,
  },
  headerSub: { color: COLORS.textDim, fontSize: 13, marginTop: 4 },
  sentList: { marginTop: 18 },
  sentRow: { alignItems: 'flex-end', marginTop: 8 },
  sentPlayer: { width: '85%' },
  composer: {
    padding: 16,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: '#dde2e8',
  },
  recorderPill: { marginBottom: 12 },
  bar: { height: 56 },
  /** Keeps the recorder mounted off-layout while idle. */
  /** Off-screen instead of `display: 'none'` so the iOS Fabric ref survives. */
  hiddenRow: {
    position: 'absolute',
    left: -100000,
    top: 0,
    opacity: 0,
  },
  startBigBtn: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#eaf1ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startBigBtnLabel: { color: COLORS.blue, fontWeight: '700', fontSize: 15 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between' },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    marginHorizontal: 4,
  },
  actionBtnDisabled: { opacity: 0.4 },
  actionBtnLabel: { fontWeight: '700' },
});
