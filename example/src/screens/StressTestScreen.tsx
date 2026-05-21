import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import {
  WaveformRecorderView,
  type WaveformRecorderViewRef,
} from 'react-native-waveform-recorder';
import { DemoCard } from '../components/DemoCard';
import { PillButton } from '../components/PillButton';
import { ScreenContainer } from '../components/ScreenContainer';
import { useExampleTheme } from '../theme';

/**
 * Long-recording stress test screen.
 *
 * Records up to 30 minutes with a tight meter pulse and reports how many
 * `onMeter` ticks have fired (proxy for "is the JS bridge keeping up?") and
 * the running peak amplitude. Used to spot leaks / dropped frames manually
 * during pre-publish QA.
 */
export default function StressTestScreen() {
  const ref = useRef<WaveformRecorderViewRef>(null);
  const [tickCount, setTickCount] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [peak, setPeak] = useState(0);
  const [running, setRunning] = useState(false);
  const [tickRate, setTickRate] = useState(0);

  // Sample the tick counter once per second so we can compute a rolling
  // ticks-per-second value without re-rendering on every meter event.
  const lastSnapshotRef = useRef({ tickCount: 0, atMs: 0 });
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const dt = (now - lastSnapshotRef.current.atMs) / 1000;
      const dTicks = tickCount - lastSnapshotRef.current.tickCount;
      if (dt > 0) setTickRate(dTicks / dt);
      lastSnapshotRef.current = { tickCount, atMs: now };
    }, 1000);
    return () => clearInterval(interval);
  }, [running, tickCount]);

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

  return (
    <ScreenContainer style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Long-recording stress test</Text>
          <Text style={styles.subtitle}>
            Records up to 30 minutes at the default 30Hz meter cadence. Watch
            the tick rate, peak amplitude, and the on-screen waveform — both
            should stay smooth and stable for the full session.
          </Text>
        </View>

        <DemoCard
          title="Recording stats"
          description="Tick rate ≈ meterUpdatesPerSecond when the JS bridge isn't backlogged. The library's amplitude history is stride-merged when it crosses 16k samples so memory stays bounded over multi-hour sessions."
        >
          <WaveformRecorderView
            ref={ref}
            style={recorderStyles.bar}
            maxDurationMs={30 * 60 * 1000}
            meterUpdatesPerSecond={30}
            samplesPerSecond={20}
            timeMode="count-up"
            onStateChange={(e) => {
              setRunning(e.state === 'recording');
              setDurationSec(Math.floor(e.durationMs / 1000));
            }}
            onMeter={(e) => {
              setTickCount((n) => n + 1);
              if (e.peak > peak) setPeak(e.peak);
            }}
            onMaxDurationReached={() => setRunning(false)}
            onComplete={(e) => {
              setRunning(false);
              setDurationSec(Math.floor(e.durationMs / 1000));
            }}
          />

          <View style={statsStyles.grid}>
            <Stat
              label="duration"
              value={`${Math.floor(durationSec / 60)}m ${durationSec % 60}s`}
            />
            <Stat label="ticks" value={tickCount.toLocaleString()} />
            <Stat label="ticks / sec" value={tickRate.toFixed(1)} />
            <Stat label="peak" value={peak.toFixed(3)} />
          </View>

          <View style={recorderStyles.row}>
            <PillButton
              label="Start 30-min run"
              variant="primary"
              onPress={() => {
                setTickCount(0);
                setPeak(0);
                setDurationSec(0);
                setTickRate(0);
                lastSnapshotRef.current = { tickCount: 0, atMs: Date.now() };
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
                setRunning(false);
              }}
            />
          </View>
        </DemoCard>
      </ScrollView>
    </ScreenContainer>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useExampleTheme();
  return (
    <View style={[statsStyles.cell, { backgroundColor: theme.surfaceAlt }]}>
      <Text style={[statsStyles.label, { color: theme.textDim }]}>{label}</Text>
      <Text style={[statsStyles.value, { color: theme.text }]}>{value}</Text>
    </View>
  );
}

const recorderStyles = StyleSheet.create({
  bar: { height: 56 } as ViewStyle,
  row: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
});

const statsStyles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, gap: 12 },
  cell: { flexBasis: '46%', padding: 10, borderRadius: 10 },
  label: { fontSize: 11, fontFamily: 'Menlo' },
  value: { fontSize: 16, fontFamily: 'Menlo', marginTop: 4 },
});
