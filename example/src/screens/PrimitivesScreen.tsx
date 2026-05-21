import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import {
  WaveformRecorderView,
  type WaveformRecorderCompleteEvent,
  type WaveformRecorderFutureBarStyle,
  type WaveformRecorderOutputFormat,
  type WaveformRecorderRecordingMode,
  type WaveformRecorderState,
  type WaveformRecorderStateChangeEvent,
  type WaveformRecorderViewRef,
} from 'react-native-waveform-recorder';
import { DemoCard } from '../components/DemoCard';
import { PillButton } from '../components/PillButton';
import { ScreenContainer } from '../components/ScreenContainer';
import { useExampleTheme } from '../theme';

/** Demo 1: default look — uncontrolled, no custom theme. Just mount + interact. */
function Demo1Default() {
  const ref = useRef<WaveformRecorderViewRef>(null);
  return (
    <DemoCard
      title="1. Default look"
      description="Uncontrolled m4a recorder with the library default theme."
    >
      <WaveformRecorderView ref={ref} style={recorderStyles.bar} />
      <View style={recorderStyles.row}>
        <PillButton
          label="Start"
          variant="primary"
          onPress={() => ref.current?.start()}
        />
        <PillButton label="Pause" onPress={() => ref.current?.pause()} />
        <PillButton label="Resume" onPress={() => ref.current?.resume()} />
        <PillButton
          label="Stop"
          variant="danger"
          onPress={() => ref.current?.stop()}
        />
        <PillButton label="Cancel" onPress={() => ref.current?.cancel()} />
      </View>
    </DemoCard>
  );
}

/** Demo 2: themed visuals. */
function Demo2Themed() {
  const ref = useRef<WaveformRecorderViewRef>(null);
  return (
    <DemoCard
      title="2. Themed visuals"
      description="Custom played / unplayed / future colors + bar geometry."
    >
      <WaveformRecorderView
        ref={ref}
        style={recorderStyles.bar}
        containerBackgroundColor="#0b1f3a"
        containerBorderRadius={24}
        playedBarColor="#00d4ff"
        unplayedBarColor="rgba(255,255,255,0.22)"
        futureBarColor="rgba(0,212,255,0.35)"
        barWidth={4}
        barGap={3}
        barRadius={4}
        timeColor="#00d4ff"
      />
      <View style={recorderStyles.row}>
        <PillButton
          label="Start"
          variant="primary"
          onPress={() => ref.current?.start()}
        />
        <PillButton
          label="Stop"
          variant="danger"
          onPress={() => ref.current?.stop()}
        />
      </View>
    </DemoCard>
  );
}

/** Demo 3: recordingMode toggle. */
function Demo3RecordingMode() {
  const ref = useRef<WaveformRecorderViewRef>(null);
  const [mode, setMode] = useState<WaveformRecorderRecordingMode>('scroll');
  return (
    <DemoCard title="3. recordingMode" description="scroll | morph | centered">
      <WaveformRecorderView
        ref={ref}
        style={recorderStyles.bar}
        recordingMode={mode}
      />
      <View style={recorderStyles.row}>
        {(['scroll', 'morph', 'centered'] as const).map((m) => (
          <PillButton
            key={m}
            label={m + (m === mode ? ' ✓' : '')}
            variant={m === mode ? 'primary' : 'neutral'}
            onPress={() => setMode(m)}
          />
        ))}
      </View>
      <View style={recorderStyles.row}>
        <PillButton
          label="Start"
          variant="primary"
          onPress={() => ref.current?.start()}
        />
        <PillButton
          label="Stop"
          variant="danger"
          onPress={() => ref.current?.stop()}
        />
      </View>
    </DemoCard>
  );
}

/** Demo 4: futureBarStyle toggle. */
function Demo4FutureBarStyle() {
  const ref = useRef<WaveformRecorderViewRef>(null);
  const [style, setStyle] = useState<WaveformRecorderFutureBarStyle>('dot');
  return (
    <DemoCard
      title="4. futureBarStyle"
      description="dot (Instagram) | line (Slack) | hidden (Tiktok)."
    >
      <WaveformRecorderView
        ref={ref}
        style={recorderStyles.bar}
        futureBarStyle={style}
      />
      <View style={recorderStyles.row}>
        {(['dot', 'line', 'hidden'] as const).map((s) => (
          <PillButton
            key={s}
            label={s + (s === style ? ' ✓' : '')}
            variant={s === style ? 'primary' : 'neutral'}
            onPress={() => setStyle(s)}
          />
        ))}
      </View>
      <View style={recorderStyles.row}>
        <PillButton
          label="Start"
          variant="primary"
          onPress={() => ref.current?.start()}
        />
        <PillButton
          label="Stop"
          variant="danger"
          onPress={() => ref.current?.stop()}
        />
      </View>
    </DemoCard>
  );
}

/** Demo 5: controlled state. */
function Demo5Controlled() {
  type AllowedState = Exclude<WaveformRecorderState, 'error'>;
  const [state, setState] = useState<AllowedState>('idle');
  return (
    <DemoCard
      title="5. Controlled state"
      description="External React state drives the recorder via the `state` prop."
    >
      <WaveformRecorderView
        style={recorderStyles.bar}
        state={state}
        onStateChange={(e: WaveformRecorderStateChangeEvent) => {
          if (e.state !== 'error') {
            setState(e.state as AllowedState);
          }
        }}
      />
      <View style={recorderStyles.row}>
        {(['idle', 'recording', 'paused', 'preview', 'stopped'] as const).map(
          (s) => (
            <PillButton
              key={s}
              label={s + (s === state ? ' ✓' : '')}
              variant={s === state ? 'primary' : 'neutral'}
              onPress={() => setState(s)}
            />
          )
        )}
      </View>
    </DemoCard>
  );
}

/** Demo 6: imperative ref. */
function Demo6Imperative() {
  const ref = useRef<WaveformRecorderViewRef>(null);
  const [lastEvent, setLastEvent] = useState<string>('—');
  const themed = useThemedStyles();
  return (
    <DemoCard
      title="6. Imperative ref"
      description="Drive the recorder via `ref.current?.start()`, `pause()`, etc."
    >
      <WaveformRecorderView
        ref={ref}
        style={recorderStyles.bar}
        onStateChange={(e) =>
          setLastEvent(`state=${e.state}, duration=${e.durationMs}ms`)
        }
      />
      <Text style={[recorderStyles.statusLine, themed.statusLine]}>
        last: {lastEvent}
      </Text>
      <View style={recorderStyles.row}>
        <PillButton
          label="Start"
          variant="primary"
          onPress={() => ref.current?.start()}
        />
        <PillButton label="Pause" onPress={() => ref.current?.pause()} />
        <PillButton label="Resume" onPress={() => ref.current?.resume()} />
        <PillButton
          label="Stop"
          variant="danger"
          onPress={() => ref.current?.stop()}
        />
        <PillButton label="Cancel" onPress={() => ref.current?.cancel()} />
      </View>
    </DemoCard>
  );
}

/** Demo 7: long-record stress test. */
function Demo7LongRecording() {
  const ref = useRef<WaveformRecorderViewRef>(null);
  const [duration, setDuration] = useState(0);
  const themed = useThemedStyles();
  const tenMinutesMs = 10 * 60 * 1000;
  return (
    <DemoCard
      title="7. Long-recording test"
      description="maxDurationMs = 10 min + count-down timer. Verifies no leaks on long sessions."
    >
      <WaveformRecorderView
        ref={ref}
        style={recorderStyles.bar}
        maxDurationMs={tenMinutesMs}
        timeMode="count-down"
        onStateChange={(e) => setDuration(e.durationMs)}
      />
      <Text style={[recorderStyles.statusLine, themed.statusLine]}>
        last reported durationMs: {duration}
      </Text>
      <View style={recorderStyles.row}>
        <PillButton
          label="Start"
          variant="primary"
          onPress={() => ref.current?.start()}
        />
        <PillButton
          label="Stop"
          variant="danger"
          onPress={() => ref.current?.stop()}
        />
      </View>
    </DemoCard>
  );
}

/** Demo 8: event log. */
function Demo8EventLog() {
  const ref = useRef<WaveformRecorderViewRef>(null);
  const [log, setLog] = useState<string[]>([]);
  const themed = useThemedStyles();

  const append = useCallback((line: string) => {
    setLog((prev) => {
      const next = [`${new Date().toLocaleTimeString()}  ${line}`, ...prev];
      return next.slice(0, 30);
    });
  }, []);

  const meterCount = useRef(0);

  return (
    <DemoCard
      title="8. Event log"
      description="Every event printed live (onMeter throttled to ~2 Hz)."
    >
      <WaveformRecorderView
        ref={ref}
        style={recorderStyles.bar}
        onStateChange={(e) =>
          append(`stateChange  state=${e.state}  durationMs=${e.durationMs}`)
        }
        onMeter={(e) => {
          meterCount.current = (meterCount.current + 1) % 15;
          if (meterCount.current !== 0) return;
          append(
            `meter  amp=${e.amplitude.toFixed(2)}  peak=${e.peak.toFixed(2)}  db=${e.db.toFixed(1)}`
          );
        }}
        onComplete={(e) => {
          append(
            `complete  uri=…${e.uri.slice(-24)}  durMs=${e.durationMs}  bytes=${e.sizeBytes}  samples=${e.samples.length}`
          );
        }}
        onMaxDurationReached={() => append('maxDurationReached')}
        onPermissionDenied={() => append('permissionDenied')}
        onError={(e) => append(`error  ${e.message} (${e.code ?? 'no-code'})`)}
      />
      <View style={recorderStyles.row}>
        <PillButton
          label="Start"
          variant="primary"
          onPress={() => ref.current?.start()}
        />
        <PillButton
          label="Stop"
          variant="danger"
          onPress={() => ref.current?.stop()}
        />
        <PillButton label="Clear log" onPress={() => setLog([])} />
      </View>
      <View style={[eventLogStyles.logBox, themed.logBox]}>
        {log.length === 0 ? (
          <Text style={[eventLogStyles.empty, themed.logEmpty]}>
            (no events yet)
          </Text>
        ) : (
          log.map((line, i) => (
            <Text key={i} style={[eventLogStyles.line, themed.logLine]}>
              {line}
            </Text>
          ))
        )}
      </View>
    </DemoCard>
  );
}

/** Demo 9: meterUpdatesPerSecond + samplesPerSecond toggles. */
function Demo9Throughput() {
  const ref = useRef<WaveformRecorderViewRef>(null);
  const [bars, setBars] = useState(12);
  const [meter, setMeter] = useState(30);
  const themed = useThemedStyles();
  return (
    <DemoCard
      title="9. Bar throughput"
      description="samplesPerSecond controls visible bar density; meterUpdatesPerSecond controls JS event rate."
    >
      <WaveformRecorderView
        ref={ref}
        style={recorderStyles.bar}
        samplesPerSecond={bars}
        meterUpdatesPerSecond={meter}
      />
      <Text style={[recorderStyles.statusLine, themed.statusLine]}>
        samplesPerSecond = {bars}, meterUpdatesPerSecond = {meter}
      </Text>
      <View style={recorderStyles.row}>
        {[6, 12, 24, 48].map((n) => (
          <PillButton
            key={`s${n}`}
            label={`bars ${n}`}
            variant={n === bars ? 'primary' : 'neutral'}
            onPress={() => setBars(n)}
          />
        ))}
      </View>
      <View style={recorderStyles.row}>
        {[15, 30, 60].map((n) => (
          <PillButton
            key={`m${n}`}
            label={`meter ${n}`}
            variant={n === meter ? 'primary' : 'neutral'}
            onPress={() => setMeter(n)}
          />
        ))}
      </View>
      <View style={recorderStyles.row}>
        <PillButton
          label="Start"
          variant="primary"
          onPress={() => ref.current?.start()}
        />
        <PillButton
          label="Stop"
          variant="danger"
          onPress={() => ref.current?.stop()}
        />
      </View>
    </DemoCard>
  );
}

/** Demo 10: onComplete summary. */
function Demo10CompleteSummary() {
  const ref = useRef<WaveformRecorderViewRef>(null);
  const [last, setLast] = useState<WaveformRecorderCompleteEvent | null>(null);
  const themed = useThemedStyles();

  const samplesPreview = useMemo(() => {
    if (!last) return '—';
    return last.samples
      .map((v) => Math.round(v * 100))
      .slice(0, 32)
      .join(', ');
  }, [last]);

  return (
    <DemoCard
      title="10. onComplete summary"
      description="WhatsApp-compatible 64-sample export + file metadata after each stop."
    >
      <WaveformRecorderView
        ref={ref}
        style={recorderStyles.bar}
        onComplete={(e) => setLast(e)}
      />
      <View style={recorderStyles.row}>
        <PillButton
          label="Start"
          variant="primary"
          onPress={() => ref.current?.start()}
        />
        <PillButton
          label="Stop"
          variant="danger"
          onPress={() => ref.current?.stop()}
        />
      </View>
      {last ? (
        <View style={[completeSummaryStyles.box, themed.summaryBox]}>
          <Text style={[completeSummaryStyles.kvKey, themed.summaryKey]}>
            uri
          </Text>
          <Text
            style={[completeSummaryStyles.kvVal, themed.summaryVal]}
            numberOfLines={1}
          >
            {last.uri}
          </Text>
          <Text style={[completeSummaryStyles.kvKey, themed.summaryKey]}>
            format / mime
          </Text>
          <Text style={[completeSummaryStyles.kvVal, themed.summaryVal]}>
            {last.format} / {last.mimeType}
          </Text>
          <Text style={[completeSummaryStyles.kvKey, themed.summaryKey]}>
            duration / size
          </Text>
          <Text style={[completeSummaryStyles.kvVal, themed.summaryVal]}>
            {(last.durationMs / 1000).toFixed(2)}s ·{' '}
            {(last.sizeBytes / 1024).toFixed(1)} KB
          </Text>
          <Text style={[completeSummaryStyles.kvKey, themed.summaryKey]}>
            peak amplitude
          </Text>
          <Text style={[completeSummaryStyles.kvVal, themed.summaryVal]}>
            {last.peakAmplitude.toFixed(3)}
          </Text>
          <Text style={[completeSummaryStyles.kvKey, themed.summaryKey]}>
            samples (first 32 of 64, ×100)
          </Text>
          <Text style={[completeSummaryStyles.kvVal, themed.summaryVal]}>
            {samplesPreview}…
          </Text>
        </View>
      ) : (
        <Text style={[recorderStyles.statusLine, themed.statusLine]}>
          (no recording yet)
        </Text>
      )}
    </DemoCard>
  );
}

/** Demo 11: output format toggle (m4a / wav / opus). */
function Demo11OutputFormat() {
  const ref = useRef<WaveformRecorderViewRef>(null);
  const [format, setFormat] = useState<WaveformRecorderOutputFormat>('m4a');
  const [last, setLast] = useState<WaveformRecorderCompleteEvent | null>(null);
  const [errorLine, setErrorLine] = useState<string | null>(null);
  const themed = useThemedStyles();

  const output = useMemo(() => ({ format }), [format]);

  return (
    <DemoCard
      title="11. Output format"
      description="Switch the on-disk format. Opus is gated by OS version (iOS 11+, Android 10+) and falls back to AAC with onError when unsupported."
    >
      <WaveformRecorderView
        ref={ref}
        style={recorderStyles.bar}
        output={output}
        onComplete={(e) => {
          setLast(e);
          setErrorLine(null);
        }}
        onError={(e) => setErrorLine(`${e.code ?? 'error'}: ${e.message}`)}
      />
      <View style={recorderStyles.row}>
        {(['m4a', 'aac', 'wav', 'opus'] as const).map((f) => (
          <PillButton
            key={f}
            label={f + (f === format ? ' ✓' : '')}
            variant={f === format ? 'primary' : 'neutral'}
            onPress={() => {
              setFormat(f);
              setLast(null);
              setErrorLine(null);
            }}
          />
        ))}
      </View>
      <View style={recorderStyles.row}>
        <PillButton
          label="Start"
          variant="primary"
          onPress={() => ref.current?.start()}
        />
        <PillButton
          label="Stop"
          variant="danger"
          onPress={() => ref.current?.stop()}
        />
      </View>
      {errorLine ? (
        <Text style={[completeSummaryStyles.kvVal, themed.summaryVal]}>
          {errorLine}
        </Text>
      ) : null}
      {last ? (
        <View style={[completeSummaryStyles.box, themed.summaryBox]}>
          <Text style={[completeSummaryStyles.kvKey, themed.summaryKey]}>
            uri
          </Text>
          <Text
            style={[completeSummaryStyles.kvVal, themed.summaryVal]}
            numberOfLines={1}
          >
            {last.uri}
          </Text>
          <Text style={[completeSummaryStyles.kvKey, themed.summaryKey]}>
            format / mime
          </Text>
          <Text style={[completeSummaryStyles.kvVal, themed.summaryVal]}>
            {last.format} / {last.mimeType}
          </Text>
          <Text style={[completeSummaryStyles.kvKey, themed.summaryKey]}>
            duration / size
          </Text>
          <Text style={[completeSummaryStyles.kvVal, themed.summaryVal]}>
            {(last.durationMs / 1000).toFixed(2)}s ·{' '}
            {(last.sizeBytes / 1024).toFixed(1)} KB
          </Text>
        </View>
      ) : (
        <Text style={[recorderStyles.statusLine, themed.statusLine]}>
          (record + stop to see file metadata)
        </Text>
      )}
    </DemoCard>
  );
}

/**
 * Layout-only styles (no colors). Module-scoped so every demo card on the
 * page shares the same reference and doesn't trigger StyleSheet rebuilds
 * on theme changes. Color comes from `useThemedStyles` below.
 */
const recorderStyles = StyleSheet.create({
  bar: { height: 56 } as ViewStyle,
  row: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  statusLine: { fontSize: 12, marginTop: 8, fontFamily: 'Menlo' },
});

const eventLogStyles = StyleSheet.create({
  logBox: { marginTop: 12, padding: 10, borderRadius: 10, minHeight: 80 },
  empty: { fontSize: 12 },
  line: { fontSize: 11, fontFamily: 'Menlo' },
});

const completeSummaryStyles = StyleSheet.create({
  box: { marginTop: 12, padding: 10, borderRadius: 10 },
  kvKey: { fontSize: 11, marginTop: 6 },
  kvVal: { fontSize: 13, fontFamily: 'Menlo', marginTop: 2 },
});

/** Theme-aware color overrides applied alongside the layout styles above. */
function useThemedStyles() {
  const theme = useExampleTheme();
  return useMemo(
    () => ({
      statusLine: { color: theme.textDim },
      logBox: { backgroundColor: theme.surfaceAlt },
      logEmpty: { color: theme.textDim },
      logLine: { color: theme.text },
      summaryBox: { backgroundColor: theme.surfaceAlt },
      summaryKey: { color: theme.textDim },
      summaryVal: { color: theme.text },
    }),
    [theme]
  );
}

export default function PrimitivesScreen() {
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
          <Text style={styles.title}>Primitives</Text>
          <Text style={styles.subtitle}>
            Building blocks: themes, modes, controlled/imperative, throughput,
            long-record + event log.
          </Text>
        </View>
        <Demo1Default />
        <Demo2Themed />
        <Demo3RecordingMode />
        <Demo4FutureBarStyle />
        <Demo5Controlled />
        <Demo6Imperative />
        <Demo7LongRecording />
        <Demo8EventLog />
        <Demo9Throughput />
        <Demo10CompleteSummary />
        <Demo11OutputFormat />
      </ScrollView>
    </ScreenContainer>
  );
}
