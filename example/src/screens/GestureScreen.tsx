import { useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import {
  WaveformRecorderView,
  type WaveformRecorderState,
  type WaveformRecorderViewRef,
} from 'react-native-waveform-recorder';
import { DemoCard } from '../components/DemoCard';
import { PillButton } from '../components/PillButton';
import { ScreenContainer } from '../components/ScreenContainer';
import { useExampleTheme } from '../theme';

/**
 * Slide-to-cancel + slide-to-lock playground.
 *
 * Demonstrates the v0.3 pan gesture stack: while recording, the user can drag
 * left to cancel or drag up to lock. `onSlideProgress` gives 0..1 progress
 * for both axes so the host UI can drive a chevron / arrow follow-along.
 */
export default function GestureScreen() {
  const ref = useRef<WaveformRecorderViewRef>(null);
  const [state, setState] = useState<WaveformRecorderState>('idle');
  const [cancelProgress, setCancelProgress] = useState(0);
  const [lockProgress, setLockProgress] = useState(0);
  const [locked, setLocked] = useState(false);
  const [eventLine, setEventLine] = useState('(no slide events yet)');

  const cancelPct = Math.round(cancelProgress * 100);
  const lockPct = Math.round(lockProgress * 100);
  const theme = useExampleTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: theme.bg },
        scrollContent: { paddingTop: 24, paddingBottom: 80 },
        header: { paddingHorizontal: 24, marginBottom: 8 },
        title: { color: theme.text, fontSize: 22, fontWeight: '800' },
        subtitle: { color: theme.textDim, fontSize: 13, marginTop: 4 },
      }),
    [theme]
  );
  const themed = useMemo(
    () => ({
      statusLine: { color: theme.textDim },
      track: { backgroundColor: theme.surfaceAlt },
      progLabel: { color: theme.textDim },
      progValue: { color: theme.text },
    }),
    [theme]
  );

  return (
    <ScreenContainer style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Slide gestures</Text>
          <Text style={styles.subtitle}>
            While recording, drag left to cancel or drag up to lock. The bar
            below visualises the live `onSlideProgress` values that fire on the
            native UI thread.
          </Text>
        </View>

        <DemoCard
          title="Slide-to-cancel + slide-to-lock"
          description="Both gestures live on the recorder view. The threshold is 80dp by default; you can tune it via the `slideTo*ThresholdDp` props."
        >
          <WaveformRecorderView
            ref={ref}
            style={recorderStyles.bar}
            enableSlideToCancel
            enableSlideToLock
            slideToCancelThresholdDp={120}
            slideToLockThresholdDp={100}
            onStateChange={(e) => setState(e.state)}
            onSlideProgress={(e) => {
              setCancelProgress(e.cancelProgress);
              setLockProgress(e.lockProgress);
            }}
            onSlideCancel={() => {
              setEventLine('onSlideCancel — recording auto-cancelled');
              ref.current?.cancel();
              setLocked(false);
            }}
            onSlideLock={() => {
              setEventLine('onSlideLock — recording is now locked');
              setLocked(true);
            }}
          />

          <View style={progressStyles.row}>
            <View style={progressStyles.cell}>
              <Text style={[progressStyles.label, themed.progLabel]}>
                cancel
              </Text>
              <View style={[progressStyles.track, themed.track]}>
                <View
                  style={[
                    progressStyles.fillCancel,
                    { width: `${cancelPct}%` },
                  ]}
                />
              </View>
              <Text style={[progressStyles.value, themed.progValue]}>
                {cancelPct}%
              </Text>
            </View>
            <View style={progressStyles.cell}>
              <Text style={[progressStyles.label, themed.progLabel]}>lock</Text>
              <View style={[progressStyles.track, themed.track]}>
                <View
                  style={[progressStyles.fillLock, { width: `${lockPct}%` }]}
                />
              </View>
              <Text style={[progressStyles.value, themed.progValue]}>
                {lockPct}%
              </Text>
            </View>
          </View>

          <Text style={[recorderStyles.statusLine, themed.statusLine]}>
            state: {state} · locked: {locked ? 'yes' : 'no'}
          </Text>
          <Text style={[recorderStyles.statusLine, themed.statusLine]}>
            {eventLine}
          </Text>

          <View style={recorderStyles.row}>
            <PillButton
              label="Start"
              variant="primary"
              onPress={() => {
                setEventLine('(no slide events yet)');
                setLocked(false);
                ref.current?.start();
              }}
            />
            <PillButton
              label="Stop"
              variant="danger"
              onPress={() => ref.current?.stop()}
            />
            <PillButton
              label="Cancel"
              onPress={() => {
                ref.current?.cancel();
                setLocked(false);
              }}
            />
          </View>
        </DemoCard>

        <DemoCard
          title="Cancel-only (WhatsApp-style)"
          description="Just slide-to-cancel; lock disabled. Useful when the host UI handles locking via a separate button."
        >
          <WaveformRecorderView
            style={recorderStyles.bar}
            enableSlideToCancel
            slideToCancelThresholdDp={80}
            onSlideProgress={(e) =>
              setEventLine(
                `cancelProgress=${e.cancelProgress.toFixed(2)} lockProgress=${e.lockProgress.toFixed(2)}`
              )
            }
            onSlideCancel={() => setEventLine('onSlideCancel fired')}
          />
          <Text style={[recorderStyles.statusLine, themed.statusLine]}>
            last: {eventLine}
          </Text>
        </DemoCard>
      </ScrollView>
    </ScreenContainer>
  );
}

const recorderStyles = StyleSheet.create({
  bar: { height: 56 } as ViewStyle,
  row: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  statusLine: { fontSize: 12, marginTop: 8, fontFamily: 'Menlo' },
});

const progressStyles = StyleSheet.create({
  row: { flexDirection: 'row', marginTop: 14, gap: 16 },
  cell: { flex: 1 },
  label: { fontSize: 11, marginBottom: 4, fontFamily: 'Menlo' },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fillCancel: { height: '100%', backgroundColor: '#ff453a' },
  fillLock: { height: '100%', backgroundColor: '#30d158' },
  value: { fontSize: 11, marginTop: 4, fontFamily: 'Menlo' },
});
