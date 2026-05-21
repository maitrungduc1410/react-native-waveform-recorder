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
  type WaveformRecorderCompleteEvent,
  type WaveformRecorderViewRef,
} from 'react-native-waveform-recorder';
import { DemoCard } from '../components/DemoCard';
import { PillButton } from '../components/PillButton';
import { ScreenContainer } from '../components/ScreenContainer';
import { useExampleTheme } from '../theme';

/**
 * 64-sample export visualization. Records audio, calls
 * `stop()`, and renders the WhatsApp-compatible 64-bucket amplitude array
 * three different ways:
 *
 *   1. As a static `<View>`-based bar chart (no third-party deps).
 *   2. As the raw int-percent array (paste into a `<Text>` for chat
 *      bubble persistence).
 *   3. As the original `number[]` (floats in [0, 1]) for advanced uses.
 */
export default function SamplesExportScreen() {
  const ref = useRef<WaveformRecorderViewRef>(null);
  const [last, setLast] = useState<WaveformRecorderCompleteEvent | null>(null);
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
      kvValue: { color: theme.text },
      kvMeta: { color: theme.textDim },
    }),
    [theme]
  );

  return (
    <ScreenContainer style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>64-sample export</Text>
          <Text style={styles.subtitle}>
            `onComplete.samples` is a 64-element `number[]` in [0, 1] computed
            on the native thread post-recording. Send it alongside the audio URL
            so chat bubbles can show a static waveform without re-decoding the
            file. Below we render it three ways.
          </Text>
        </View>

        <DemoCard
          title="Record and stop to populate"
          description="The recorder produces a 64-bucket array on every stop. The static chart below mimics the visual you'd render in a chat bubble."
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
            <PillButton label="Clear" onPress={() => setLast(null)} />
          </View>
        </DemoCard>

        {last ? (
          <>
            <DemoCard
              title="1. Static <View> bar chart"
              description="64 vertically-centered bars rendered with plain flex + width. Drop-in for chat bubbles — no SVG / Skia needed."
            >
              <View style={chartStyles.row}>
                {last.samples.map((value, i) => {
                  const height = Math.max(2, value * 40);
                  return (
                    <View
                      key={i}
                      style={[chartStyles.bar, { height: height as number }]}
                    />
                  );
                })}
              </View>
            </DemoCard>

            <DemoCard
              title="2. Integer-percent payload"
              description="Most chat backends like a compact int representation. Round to 0..100 and serialise as a string for the bubble payload."
            >
              <Text style={[kvStyles.value, themed.kvValue]}>
                [{last.samples.map((v) => Math.round(v * 100)).join(', ')}]
              </Text>
              <Text style={[kvStyles.meta, themed.kvMeta]}>
                ({last.samples.length} buckets · {last.samples.length * 3}–
                {last.samples.length * 4}B as ASCII CSV)
              </Text>
            </DemoCard>

            <DemoCard
              title="3. Raw number[] (floats 0..1)"
              description="The exact event payload you get from onComplete.samples — useful when feeding the array back into the player library to render the bubble."
            >
              <Text style={[kvStyles.value, themed.kvValue]}>
                [
                {last.samples
                  .map((v) => v.toFixed(3))
                  .slice(0, 12)
                  .join(', ')}
                , …]
              </Text>
              <Text style={[kvStyles.meta, themed.kvMeta]}>
                uri: {last.uri.split('/').slice(-1)[0]}
              </Text>
              <Text style={[kvStyles.meta, themed.kvMeta]}>
                {last.format} · {(last.sizeBytes / 1024).toFixed(1)} KB ·{' '}
                {(last.durationMs / 1000).toFixed(2)}s · peak{' '}
                {last.peakAmplitude.toFixed(3)}
              </Text>
            </DemoCard>
          </>
        ) : (
          <Text style={[recorderStyles.statusLine, themed.statusLine]}>
            (record + stop to see the 64-bucket export)
          </Text>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const recorderStyles = StyleSheet.create({
  bar: { height: 56 } as ViewStyle,
  row: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  statusLine: {
    fontSize: 13,
    marginHorizontal: 24,
    marginTop: 12,
    fontFamily: 'Menlo',
  },
});

const chartStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', height: 48, gap: 2 },
  bar: {
    flex: 1,
    backgroundColor: '#00d4ff',
    borderRadius: 2,
  } as ViewStyle,
});

const kvStyles = StyleSheet.create({
  value: { fontSize: 11, fontFamily: 'Menlo', marginTop: 8 },
  meta: { fontSize: 11, marginTop: 4, fontFamily: 'Menlo' },
});
