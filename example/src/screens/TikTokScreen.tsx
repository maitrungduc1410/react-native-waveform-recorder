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
  bg: '#000',
  text: '#fff',
  textDim: '#9aa0a6',
  red: '#fe2c55',
  cyan: '#25f4ee',
  surface: '#111',
} as const;

/**
 * TikTok-style minimal recording pill recipe.
 *
 * No preview, scrolling waveform only, three-button row: trash · bars ·
 * send. Hidden future bars + thin scrolling design.
 *
 * Persistent-recorder pattern: the [WaveformRecorderView] is mounted
 * once and hidden via `display: 'none'` while idle so the "Hold to
 * record" CTA's `start()` call always reaches the native engine.
 */
export default function TikTokScreen() {
  const ref = useRef<WaveformRecorderViewRef>(null);
  const [state, setState] = useState<WaveformRecorderState>('idle');
  const { notes: sentVoiceNotes, add: addSentVoiceNote } = useSentVoiceNotes();

  const isIdle = state === 'idle' || state === 'stopped';

  return (
    <ScreenContainer style={styles.root}>
      <ScrollView
        style={styles.center}
        contentContainerStyle={styles.centerInner}
      >
        <Text style={styles.heroTitle}>TikTok recipe</Text>
        <Text style={styles.heroSub}>
          Minimal pill: trash · scrolling waveform · send. No preview.
        </Text>
        <SentReel voiceNotes={sentVoiceNotes} />
      </ScrollView>

      <View style={styles.bottom}>
        {isIdle ? (
          <Pressable
            style={[styles.recordBigBtn, { backgroundColor: COLORS.red }]}
            onPress={() => ref.current?.start()}
          >
            <Text style={[styles.recordBigBtnLabel, { color: COLORS.text }]}>
              Hold to record
            </Text>
          </Pressable>
        ) : null}

        <View style={[styles.pillRow, isIdle && styles.hiddenRow]}>
          <Pressable
            onPress={() => ref.current?.cancel()}
            style={[styles.circleBtn, { backgroundColor: COLORS.surface }]}
          >
            <Text style={styles.circleGlyph}>🗑</Text>
          </Pressable>
          <View style={styles.recorderWrap}>
            <WaveformRecorderView
              ref={ref}
              style={styles.bar}
              containerBackgroundColor={COLORS.surface as ColorValue}
              containerBorderRadius={28}
              playedBarColor={COLORS.cyan as ColorValue}
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
            style={[styles.circleBtn, { backgroundColor: COLORS.red }]}
          >
            <Text style={[styles.circleGlyph, { color: COLORS.text }]}>➤</Text>
          </Pressable>
        </View>
      </View>
    </ScreenContainer>
  );
}

/**
 * "Recent sends" feed — each voice note posted in this session is
 * rendered with `AudioWaveformView` from `react-native-waveform-player`,
 * reusing the recorder's emitted file URI + 64-bucket peaks so playback
 * UI is instant and decode-free.
 */
function SentReel({ voiceNotes }: { voiceNotes: VoiceNote[] }) {
  if (voiceNotes.length === 0) return null;
  return (
    <View style={styles.reel}>
      <Text style={styles.reelHeading}>Recent sends</Text>
      {voiceNotes
        .slice()
        .reverse()
        .map((note) => (
          <View key={note.id} style={styles.reelCard}>
            <SentVoiceNote
              note={note}
              theme={{
                containerBackgroundColor: COLORS.surface as ColorValue,
                playedBarColor: COLORS.cyan as ColorValue,
                unplayedBarColor: 'rgba(255,255,255,0.3)',
                foregroundColor: COLORS.cyan as ColorValue,
                speedColor: COLORS.text as ColorValue,
                speedBackgroundColor: 'rgba(37,244,238,0.18)',
              }}
              containerBorderRadius={14}
              style={styles.reelPlayer}
            />
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg, padding: 16 },
  center: { flex: 1 },
  centerInner: { alignItems: 'stretch', paddingTop: 32, paddingBottom: 16 },
  heroTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  heroSub: {
    color: COLORS.textDim,
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  reel: { marginTop: 28 },
  reelHeading: {
    color: COLORS.textDim,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  reelCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 8,
    marginBottom: 10,
  },
  reelPlayer: { width: '100%' },
  bottom: { paddingTop: 12 },
  recordBigBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  recordBigBtnLabel: { fontWeight: '800', fontSize: 16 },
  pillRow: { flexDirection: 'row', alignItems: 'center' },
  /** Keeps the recorder mounted off-layout while idle. */
  /** Off-screen instead of `display: 'none'` so the iOS Fabric ref survives. */
  hiddenRow: {
    position: 'absolute',
    left: -100000,
    top: 0,
    opacity: 0,
  },
  recorderWrap: { flex: 1, marginHorizontal: 8 },
  circleBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleGlyph: { color: COLORS.text, fontSize: 18, fontWeight: '800' },
  bar: { height: 56 },
});
