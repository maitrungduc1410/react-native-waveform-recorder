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
  bg: '#0e1218',
  surface: '#181c24',
  text: '#e5e8eb',
  textDim: '#8e95a3',
  primary: '#0084ff',
  red: '#ff3b30',
  white: '#fff',
} as const;

/**
 * Messenger-style bottom-sheet recorder recipe.
 *
 * Records into a compact pill, then expands the same surface into a
 * larger preview "sheet" with a scrub hint on pause.
 *
 * Single-instance recorder pattern: the [WaveformRecorderView] is mounted
 * exactly once at a stable position in the tree. The outer container's
 * styling and the surrounding chrome (cancel button, sheet handle, etc.)
 * change based on `state`. This keeps `ref.current` alive from the moment
 * the screen mounts, which is what makes the "Tap to record" mic button
 * actually call `start()` on the native engine.
 */
export default function MessengerScreen() {
  const ref = useRef<WaveformRecorderViewRef>(null);
  const [state, setState] = useState<WaveformRecorderState>('idle');
  const { notes: sentVoiceNotes, add: addSentVoiceNote } = useSentVoiceNotes();

  const isPreviewLike = state === 'paused' || state === 'preview';
  const isRecording = state === 'recording';
  const isIdle = !isPreviewLike && !isRecording;

  return (
    <ScreenContainer style={styles.root}>
      <ScrollView contentContainerStyle={styles.feed}>
        <Header />
        <SentBubbles voiceNotes={sentVoiceNotes} />
      </ScrollView>

      {/* Composer surface — morphs from compact composer to preview sheet
          via style overrides. The recorder slot inside is the same node
          across all three states, so the ref never goes stale. */}
      <View style={[styles.composer, isPreviewLike && styles.previewSheet]}>
        {isPreviewLike ? (
          <>
            <View style={styles.handle} />
            <Text style={styles.sheetHint}>
              Slide finger on recording to play from any point
            </Text>
          </>
        ) : null}

        {isIdle ? (
          <Pressable
            style={styles.recordPill}
            onPress={() => ref.current?.start()}
          >
            <Text style={styles.recordPillLabel}>Tap to record</Text>
            <View style={styles.micCircle}>
              <Text style={styles.micGlyph}>🎙</Text>
            </View>
          </Pressable>
        ) : null}

        <View
          style={[
            styles.recordRow,
            isIdle && styles.hiddenRow,
            isPreviewLike && styles.previewRecordRow,
          ]}
        >
          {isRecording ? (
            <Pressable
              hitSlop={6}
              onPress={() => ref.current?.cancel()}
              style={styles.smallCircle}
            >
              <Text style={styles.smallGlyph}>✕</Text>
            </Pressable>
          ) : null}

          <View
            style={[
              styles.recorderWrap,
              isPreviewLike && styles.recorderWrapPreview,
            ]}
          >
            <WaveformRecorderView
              ref={ref}
              style={isPreviewLike ? styles.previewBar : styles.recordBar}
              containerBackgroundColor={COLORS.surface as ColorValue}
              playedBarColor={COLORS.primary as ColorValue}
              unplayedBarColor="rgba(255,255,255,0.25)"
              playButtonColor={COLORS.primary as ColorValue}
              futureBarStyle="hidden"
              showTime
              timeColor={COLORS.white as ColorValue}
              enableContinueRecording
              onStateChange={(e) => setState(e.state)}
              onComplete={addSentVoiceNote}
            />
          </View>

          {isRecording ? (
            <Pressable
              hitSlop={6}
              onPress={() => {
                ref.current?.pause();
                setTimeout(() => ref.current?.enterPreview(), 60);
              }}
              style={[styles.smallCircle, styles.smallCircleAccent]}
            >
              <Text style={styles.smallGlyph}>⏸︎</Text>
            </Pressable>
          ) : null}
        </View>

        {isPreviewLike ? (
          <View style={styles.sheetActions}>
            <PillIcon
              label="Trash"
              color={COLORS.red as ColorValue}
              onPress={() => ref.current?.cancel()}
            />
            <PillIcon
              label="Continue"
              color={COLORS.primary as ColorValue}
              onPress={() => ref.current?.resume()}
            />
            <PillIcon
              label="Send"
              color={COLORS.primary as ColorValue}
              filled
              onPress={() => ref.current?.stop()}
            />
          </View>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

function Header() {
  return (
    <View style={styles.headerBlock}>
      <Text style={styles.headerTitle}>Messenger recipe</Text>
      <Text style={styles.headerSub}>
        Compact composer pill while recording, sheet for preview & scrub.
      </Text>
    </View>
  );
}

/**
 * Renders one "out" voice bubble per recording, using `AudioWaveformView`
 * from `react-native-waveform-player`. The recorder hands off the file
 * URI and the 64-bucket peaks via `onComplete`, and we forward both to
 * the player so the bubble paints without re-decoding the audio.
 */
function SentBubbles({ voiceNotes }: { voiceNotes: VoiceNote[] }) {
  if (voiceNotes.length === 0) return null;
  return (
    <View style={styles.sentList}>
      {voiceNotes.map((note) => (
        <View key={note.id} style={styles.sentBubbleRow}>
          <SentVoiceNote
            note={note}
            theme={{
              containerBackgroundColor: COLORS.primary as ColorValue,
              playedBarColor: COLORS.white as ColorValue,
              unplayedBarColor: 'rgba(255,255,255,0.45)',
              foregroundColor: COLORS.white as ColorValue,
            }}
            containerBorderRadius={22}
            style={styles.sentBubble}
          />
        </View>
      ))}
    </View>
  );
}

function PillIcon({
  label,
  color,
  filled = false,
  onPress,
}: {
  label: string;
  color: ColorValue;
  filled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pillIcon,
        filled ? { backgroundColor: color } : { borderColor: color },
      ]}
    >
      <Text
        style={[
          styles.pillIconLabel,
          filled
            ? { color: COLORS.white }
            : typeof color === 'string'
              ? { color }
              : { color: COLORS.white },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  feed: { padding: 16, paddingBottom: 220 },
  headerBlock: { marginTop: 24 },
  headerTitle: { color: COLORS.text, fontSize: 22, fontWeight: '800' },
  headerSub: { color: COLORS.textDim, fontSize: 13, marginTop: 4 },
  composer: { padding: 12, backgroundColor: COLORS.bg },
  previewSheet: {
    padding: 16,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  /** Hides the recording row from layout without unmounting the recorder. */
  /**
   * Used while idle: parks the recording row off-screen *without*
   * unmounting it, so `ref.current` stays valid for `start()`.
   * `display: 'none'` would tear down the iOS Fabric view and null
   * the imperative ref — see WhatsAppScreen for the long version.
   */
  hiddenRow: {
    position: 'absolute',
    left: -100000,
    top: 0,
    opacity: 0,
  },
  recordPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
  },
  recordPillLabel: { color: COLORS.textDim, flex: 1, fontSize: 14 },
  micCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micGlyph: { color: COLORS.white, fontSize: 18 },
  recordRow: { flexDirection: 'row', alignItems: 'center' },
  previewRecordRow: { marginTop: 4 },
  recorderWrap: { flex: 1, marginHorizontal: 6 },
  recorderWrapPreview: { marginHorizontal: 0 },
  recordBar: { height: 44 },
  previewBar: { height: 56 },
  smallCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallCircleAccent: { backgroundColor: COLORS.primary },
  smallGlyph: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.textDim,
    marginBottom: 12,
  },
  sheetHint: {
    color: COLORS.textDim,
    fontSize: 12,
    marginBottom: 10,
    textAlign: 'center',
  },
  sheetActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 14,
  },
  pillIcon: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'transparent',
    minWidth: 96,
    alignItems: 'center',
  },
  pillIconLabel: { fontWeight: '700', fontSize: 13 },
  sentList: { marginTop: 16 },
  sentBubbleRow: { alignItems: 'flex-end', marginTop: 8 },
  sentBubble: { width: '85%' },
});
