import { useRef, useState } from 'react';
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

/**
 * WhatsApp 64-bucket sample export.
 *
 * Shows what `onComplete.samples` looks like in practice: the engine emits a
 * 64-element array of normalised RMS values (0..1). WhatsApp packs this as a
 * 64-byte payload (0..100 per byte) inside the message protobuf. This screen
 * renders both the raw numbers and a static `<View>` "chat bubble" preview
 * the host could pin into a message bubble.
 */
export default function WhatsAppSamplesScreen() {
  const ref = useRef<WaveformRecorderViewRef>(null);
  const [last, setLast] = useState<WaveformRecorderCompleteEvent | null>(null);

  // The 0..100 byte payload that maps 1:1 with WhatsApp's wire format. We
  // expose this so the host can serialise/upload it alongside the audio
  // file.
  const whatsappBytes = last
    ? last.samples.map((v) => Math.max(0, Math.min(100, Math.round(v * 100))))
    : [];

  return (
    <ScreenContainer style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>64-bucket sample export</Text>
          <Text style={styles.subtitle}>
            `onComplete.samples` is a 64-element array of normalised RMS values
            (0..1). WhatsApp packs the same array as 64 bytes (0..100 each) into
            the message protobuf — the bars below render directly from those
            bytes.
          </Text>
        </View>

        <DemoCard
          title="Record + stop to inspect the export"
          description="Speak for a few seconds, then tap Stop. The static <View>-based bar render is intentionally JS-only so you can drop it into your own message bubble."
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
              onPress={() => {
                setLast(null);
                ref.current?.start();
              }}
            />
            <PillButton
              label="Stop"
              variant="danger"
              onPress={() => ref.current?.stop()}
            />
            <PillButton label="Clear" onPress={() => setLast(null)} />
          </View>

          {last ? (
            <View style={completeStyles.box}>
              <Text style={completeStyles.kvKey}>uri</Text>
              <Text style={completeStyles.kvVal} numberOfLines={1}>
                {last.uri}
              </Text>
              <Text style={completeStyles.kvKey}>duration / size</Text>
              <Text style={completeStyles.kvVal}>
                {(last.durationMs / 1000).toFixed(2)}s ·{' '}
                {(last.sizeBytes / 1024).toFixed(1)} KB
              </Text>
              <Text style={completeStyles.kvKey}>peak amplitude</Text>
              <Text style={completeStyles.kvVal}>
                {last.peakAmplitude.toFixed(3)}
              </Text>

              <Text style={completeStyles.kvKey}>
                WhatsApp byte array (64 × 0..100)
              </Text>
              <Text style={completeStyles.kvVal}>
                {whatsappBytes.join(', ')}
              </Text>

              <Text style={completeStyles.kvKey}>
                Static View-based preview (drop-in for chat bubbles)
              </Text>
              <View style={bubbleStyles.bubble}>
                <View style={bubbleStyles.barsRow}>
                  {whatsappBytes.map((byte, i) => (
                    <View
                      key={i}
                      style={[
                        bubbleStyles.bar,
                        {
                          height: 6 + (byte / 100) * 26,
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text style={bubbleStyles.bubbleMeta}>
                  {(last.durationMs / 1000).toFixed(1)}s · {last.format}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={recorderStyles.statusLine}>
              (record + stop to inspect the 64-sample export)
            </Text>
          )}
        </DemoCard>
      </ScrollView>
    </ScreenContainer>
  );
}

const recorderStyles = StyleSheet.create({
  bar: { height: 56 } as ViewStyle,
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  statusLine: {
    color: '#9aa0a6',
    fontSize: 12,
    marginTop: 12,
    fontFamily: 'Menlo',
  },
});

const completeStyles = StyleSheet.create({
  box: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#0a0a0b',
  },
  kvKey: { color: '#5f6368', fontSize: 11, marginTop: 8 },
  kvVal: { color: '#fff', fontSize: 12, fontFamily: 'Menlo', marginTop: 2 },
});

const bubbleStyles = StyleSheet.create({
  bubble: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#1f3a2f',
    borderRadius: 14,
    alignSelf: 'flex-start',
    maxWidth: '92%',
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
  },
  bar: {
    width: 2,
    marginRight: 1,
    borderRadius: 1,
    backgroundColor: '#86d3a1',
  },
  bubbleMeta: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    marginTop: 6,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  scrollContent: { paddingTop: 24, paddingBottom: 80 },
  header: { paddingHorizontal: 24, marginBottom: 8 },
  title: { color: '#fff', fontSize: 22, fontWeight: '800' },
  subtitle: { color: '#9aa0a6', fontSize: 13, marginTop: 4 },
});
