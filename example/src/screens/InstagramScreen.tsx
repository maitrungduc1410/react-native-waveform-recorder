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
  blue: '#0095f6',
  blueDim: '#1e3a8a',
  white: '#fff',
  textDim: '#9aa0a6',
  surface: '#0f1115',
} as const;

/**
 * Instagram-style recorder recipe.
 *
 * Solid blue pill + dotted future bars + edit / new chip row above.
 * Right side has a state-aware FAB:
 *   * idle       → tap to start recording
 *   * recording  → tap to stop & send (also shows a paired cancel pill)
 *
 * The [WaveformRecorderView] is mounted once and stays in the layout
 * across all states, so the FAB always has a valid ref.
 */
export default function InstagramScreen() {
  const ref = useRef<WaveformRecorderViewRef>(null);
  const [state, setState] = useState<WaveformRecorderState>('idle');
  const { notes: sentVoiceNotes, add: addSentVoiceNote } = useSentVoiceNotes();

  const isRecording = state === 'recording';
  const isPreviewLike = state === 'paused' || state === 'preview';
  const isIdle = !isRecording && !isPreviewLike;

  return (
    <ScreenContainer style={styles.root}>
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyInner}>
        <Text style={styles.headerTitle}>Instagram recipe</Text>
        <Text style={styles.headerSub}>
          Solid blue pill · dotted future bars · always-mounted recorder.
        </Text>

        <View style={styles.pillRow}>
          <ChipBtn label="Edit" />
          <ChipBtn label="New" />
        </View>

        <SentDmList voiceNotes={sentVoiceNotes} />
      </ScrollView>

      <View style={styles.composer}>
        <View style={styles.composerInner}>
          {!isIdle ? (
            <Pressable
              onPress={() => ref.current?.cancel()}
              style={[styles.fab, { backgroundColor: COLORS.surface }]}
            >
              <Text style={styles.fabGlyph}>✕</Text>
            </Pressable>
          ) : null}

          <View style={styles.recorderWrap}>
            <WaveformRecorderView
              ref={ref}
              style={styles.bar}
              containerBackgroundColor={COLORS.blue as ColorValue}
              containerBorderRadius={28}
              playedBarColor={COLORS.white as ColorValue}
              unplayedBarColor="rgba(255,255,255,0.45)"
              futureBarColor="rgba(255,255,255,0.7)"
              playButtonColor={COLORS.white as ColorValue}
              timeColor={COLORS.white as ColorValue}
              barWidth={3}
              barGap={3}
              showTime
              enablePreview
              enableContinueRecording
              onStateChange={(e) => setState(e.state)}
              onComplete={addSentVoiceNote}
            />
          </View>

          <Pressable
            onPress={() =>
              isIdle ? ref.current?.start() : ref.current?.stop()
            }
            style={[
              styles.fab,
              { backgroundColor: isIdle ? COLORS.blueDim : COLORS.blue },
            ]}
          >
            <Text style={styles.fabGlyph}>{isIdle ? '●' : '➤'}</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>
          {isIdle
            ? 'Tap the red dot to start recording.'
            : isRecording
              ? 'Recording — tap the arrow to send.'
              : 'Paused — tap the arrow to send or ✕ to discard.'}
        </Text>
      </View>
    </ScreenContainer>
  );
}

function ChipBtn({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{label}</Text>
    </View>
  );
}

/**
 * Fake "DM thread" of voice notes the user has sent in this session.
 * Each one is rendered with `AudioWaveformView` from
 * `react-native-waveform-player`, fed the same file URI and 64-bucket
 * peaks that the recorder emitted via `onComplete` — no decode pass.
 */
function SentDmList({ voiceNotes }: { voiceNotes: VoiceNote[] }) {
  if (voiceNotes.length === 0) return null;
  return (
    <View style={styles.dmList}>
      <Text style={styles.dmHeading}>Sent to @them</Text>
      {voiceNotes.map((note) => (
        <View key={note.id} style={styles.dmRow}>
          <SentVoiceNote
            note={note}
            theme={{
              containerBackgroundColor: COLORS.blue as ColorValue,
              playedBarColor: COLORS.white as ColorValue,
              unplayedBarColor: 'rgba(255,255,255,0.45)',
              foregroundColor: COLORS.white as ColorValue,
            }}
            containerBorderRadius={24}
            style={styles.dmPlayer}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  body: { flex: 1 },
  bodyInner: { padding: 16, paddingBottom: 24 },
  headerTitle: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 24,
  },
  headerSub: { color: COLORS.textDim, fontSize: 13, marginTop: 4 },
  pillRow: { flexDirection: 'row', marginTop: 24 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    marginRight: 8,
  },
  chipLabel: { color: COLORS.white, fontWeight: '700' },
  composer: { padding: 12, backgroundColor: COLORS.bg },
  composerInner: { flexDirection: 'row', alignItems: 'center' },
  recorderWrap: { flex: 1, marginHorizontal: 8 },
  bar: { height: 56 },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabGlyph: { color: COLORS.white, fontWeight: '900', fontSize: 18 },
  hint: {
    color: COLORS.textDim,
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  dmList: { marginTop: 24 },
  dmHeading: {
    color: COLORS.textDim,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  dmRow: { alignItems: 'flex-end', marginTop: 8 },
  dmPlayer: { width: '88%' },
});
