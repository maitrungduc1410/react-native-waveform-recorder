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
  type WaveformRecorderViewRef,
} from 'react-native-waveform-recorder';
import {
  decodePcmChunk,
  pcmToMonoFloat32,
} from 'react-native-waveform-recorder/pcm-stream';
import { DemoCard } from '../components/DemoCard';
import { PillButton } from '../components/PillButton';
import { ScreenContainer } from '../components/ScreenContainer';
import { useExampleTheme } from '../theme';

/**
 * Opt-in raw-PCM streaming via the `/pcm-stream` subpath.
 *
 * Demonstrates the full pipeline:
 *   1. Configure the recorder for WAV @ 16kHz mono.
 *   2. Enable `enablePcmStream` + pick a chunk cadence.
 *   3. Decode the base64 payload to Int16Array, then Float32Array, and
 *      compute a quick RMS to prove the data is real.
 *
 * For multi-MB/s audio pipelines you'll want a true JSI module — this
 * subpath is sized for STT / VAD style consumers that read at < 1 MB/s.
 */
export default function PcmStreamScreen() {
  const ref = useRef<WaveformRecorderViewRef>(null);
  const [chunkCount, setChunkCount] = useState(0);
  const [bytesTotal, setBytesTotal] = useState(0);
  const [lastRms, setLastRms] = useState(0);
  const [lastChunkSamples, setLastChunkSamples] = useState(0);
  const [meta, setMeta] = useState<string>('—');
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
          <Text style={styles.title}>Raw PCM stream</Text>
          <Text style={styles.subtitle}>
            Opt-in via {`react-native-waveform-recorder/pcm-stream`}. Requires{' '}
            WAV output. Default bundle stays untouched if you never import the
            subpath.
          </Text>
        </View>

        <DemoCard
          title="WAV 16kHz mono · 100ms chunks"
          description="Each onPcmChunk fires a base64 string of 16-bit PCM. We decode in JS, mix to mono Float32, and compute RMS as a sanity check — no native module dependency."
        >
          <WaveformRecorderView
            ref={ref}
            style={recorderStyles.bar}
            output={{ format: 'wav', sampleRate: 16000, channels: 1 }}
            enablePcmStream
            pcmChunkMs={100}
            onPcmChunk={(e) => {
              const int16 = decodePcmChunk(e.chunk);
              const f32 = pcmToMonoFloat32(int16, e.channels);
              let sumSq = 0;
              for (let i = 0; i < f32.length; i++) sumSq += f32[i]! * f32[i]!;
              const rms = Math.sqrt(sumSq / Math.max(1, f32.length));
              setChunkCount((n) => n + 1);
              setBytesTotal((n) => n + int16.byteLength);
              setLastRms(rms);
              setLastChunkSamples(f32.length);
              setMeta(
                `${e.sampleRate}Hz · ${e.channels}ch · ${e.bytesPerSample * 8}-bit · t=${e.timestampMs}ms`
              );
            }}
            onError={(e) => setMeta(`error: ${e.code} — ${e.message}`)}
          />

          <View style={statsStyles.grid}>
            <Stat label="chunks" value={chunkCount.toLocaleString()} />
            <Stat
              label="bytes"
              value={`${(bytesTotal / 1024).toFixed(1)} KB`}
            />
            <Stat
              label="last RMS"
              value={lastRms > 0 ? lastRms.toFixed(4) : '—'}
            />
            <Stat label="samples / chunk" value={String(lastChunkSamples)} />
          </View>
          <Text style={[statsStyles.meta, { color: theme.textDim }]}>
            {meta}
          </Text>

          <View style={recorderStyles.row}>
            <PillButton
              label="Start"
              variant="primary"
              onPress={() => {
                setChunkCount(0);
                setBytesTotal(0);
                setLastRms(0);
                setLastChunkSamples(0);
                setMeta('—');
                ref.current?.start();
              }}
            />
            <PillButton
              label="Stop"
              variant="danger"
              onPress={() => ref.current?.stop()}
            />
            <PillButton label="Cancel" onPress={() => ref.current?.cancel()} />
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
  meta: { fontFamily: 'Menlo', fontSize: 11, marginTop: 8 },
});
