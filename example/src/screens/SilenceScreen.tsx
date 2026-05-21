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
 * Silence detection demo. Configures `silenceThresholdDb` +
 * `silenceTimeoutMs`, and toggles `autoStopOnSilence`.
 */
export default function SilenceScreen() {
  const ref = useRef<WaveformRecorderViewRef>(null);
  const [state, setState] = useState<WaveformRecorderState>('idle');
  const [threshold, setThreshold] = useState(-40);
  const [timeout, setTimeoutMs] = useState(1500);
  const [autoStop, setAutoStop] = useState(true);
  const [events, setEvents] = useState<string[]>([]);
  const [meterDb, setMeterDb] = useState<number>(-160);

  const append = (line: string) => {
    setEvents((prev) =>
      [`${new Date().toLocaleTimeString()}  ${line}`, ...prev].slice(0, 12)
    );
  };

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
      logBox: { backgroundColor: theme.surfaceAlt },
      logEmpty: { color: theme.textDim },
      logLine: { color: theme.text },
    }),
    [theme]
  );

  return (
    <ScreenContainer style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Silence detection</Text>
          <Text style={styles.subtitle}>
            The recorder polls the mic at `meterUpdatesPerSecond`. When the
            rolling dB stays below `silenceThresholdDb` for at least
            `silenceTimeoutMs`, `onSilenceDetected` fires. With
            `autoStopOnSilence` on, the engine also stops the recording.
          </Text>
        </View>

        <DemoCard
          title={`Threshold ${threshold} dB · timeout ${timeout} ms · autoStop ${autoStop ? 'on' : 'off'}`}
          description="Try recording, then stop talking — once silence persists for the timeout, onSilenceDetected (or auto-stop) fires."
        >
          <WaveformRecorderView
            ref={ref}
            style={recorderStyles.bar}
            silenceThresholdDb={threshold}
            silenceTimeoutMs={timeout}
            autoStopOnSilence={autoStop}
            onStateChange={(e) => setState(e.state)}
            onMeter={(e) => setMeterDb(e.db)}
            onSilenceDetected={(e) =>
              append(`silenceDetected: ${e.durationMs}ms below ${threshold}dB`)
            }
            onComplete={(e) =>
              append(`complete  bytes=${e.sizeBytes}  durMs=${e.durationMs}`)
            }
          />
          <Text style={[recorderStyles.statusLine, themed.statusLine]}>
            state: {state} · last meter dB: {meterDb.toFixed(1)}
          </Text>

          <View style={recorderStyles.row}>
            {[-30, -40, -50, -60].map((t) => (
              <PillButton
                key={t}
                label={`${t}dB${t === threshold ? ' ✓' : ''}`}
                variant={t === threshold ? 'primary' : 'neutral'}
                onPress={() => setThreshold(t)}
              />
            ))}
          </View>
          <View style={recorderStyles.row}>
            {[1000, 1500, 3000, 5000].map((t) => (
              <PillButton
                key={t}
                label={`${t}ms${t === timeout ? ' ✓' : ''}`}
                variant={t === timeout ? 'primary' : 'neutral'}
                onPress={() => setTimeoutMs(t)}
              />
            ))}
          </View>
          <View style={recorderStyles.row}>
            <PillButton
              label={`autoStop: ${autoStop ? 'on' : 'off'}`}
              variant={autoStop ? 'primary' : 'neutral'}
              onPress={() => setAutoStop((v) => !v)}
            />
          </View>

          <View style={recorderStyles.row}>
            <PillButton
              label="Start"
              variant="primary"
              onPress={() => {
                setEvents([]);
                ref.current?.start();
              }}
            />
            <PillButton
              label="Stop"
              variant="danger"
              onPress={() => ref.current?.stop()}
            />
          </View>

          <View style={[eventLogStyles.logBox, themed.logBox]}>
            {events.length === 0 ? (
              <Text style={[eventLogStyles.empty, themed.logEmpty]}>
                (no events yet)
              </Text>
            ) : (
              events.map((line, i) => (
                <Text key={i} style={[eventLogStyles.line, themed.logLine]}>
                  {line}
                </Text>
              ))
            )}
          </View>
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

const eventLogStyles = StyleSheet.create({
  logBox: { marginTop: 12, padding: 10, borderRadius: 10, minHeight: 100 },
  empty: { fontSize: 12 },
  line: { fontSize: 11, fontFamily: 'Menlo' },
});
