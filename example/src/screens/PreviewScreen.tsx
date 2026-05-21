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
  type WaveformRecorderState,
  type WaveformRecorderViewRef,
} from 'react-native-waveform-recorder';
import { DemoCard } from '../components/DemoCard';
import { PillButton } from '../components/PillButton';
import { ScreenContainer } from '../components/ScreenContainer';
import { useExampleTheme } from '../theme';

/**
 * Preview API showcase.
 *
 * Drives the four imperative preview commands explicitly so the API
 * surface is obvious, with on-screen captions for what each one does:
 *   * `enterPreview()`         — auto-pauses recording (if needed),
 *                                snapshots a playable URL, swaps the
 *                                bars view to the static playback
 *                                renderer, and points the player at it.
 *   * `exitPreview()`          — leaves preview without finalising;
 *                                recorder returns to `betweenSegments`
 *                                (surfaced as `paused`) so you can keep
 *                                appending or `stop()` to send.
 *   * `togglePreviewPlayback()`— equivalent of tapping the built-in play
 *                                button. Useful when you hide the
 *                                button (`showPlayButton={false}`) and
 *                                drive playback from your own chrome.
 *   * `seekPreview(positionMs)`— jumps the playhead. Fires `onSeek` and
 *                                refreshes the bars-view fill instantly
 *                                (independent of the 30 Hz tick).
 *
 * The screen also surfaces the supporting events — `onStateChange`,
 * `onPlaybackTimeUpdate`, `onSeek`, `onComplete` — so the contract is
 * visible end-to-end.
 */
export default function PreviewScreen() {
  const ref = useRef<WaveformRecorderViewRef>(null);
  const [state, setState] = useState<WaveformRecorderState>('idle');
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [lastSeek, setLastSeek] = useState<number | null>(null);
  const [enablePreview, setEnablePreview] = useState(true);
  const [enableContinue, setEnableContinue] = useState(true);
  const [showPlayButton, setShowPlayButton] = useState(true);
  const [completion, setCompletion] = useState<string | null>(null);
  const [events, setEvents] = useState<string[]>([]);

  const append = useCallback((line: string) => {
    setEvents((prev) =>
      [`${new Date().toLocaleTimeString()}  ${line}`, ...prev].slice(0, 18)
    );
  }, []);

  const isRecording = state === 'recording';
  const isPaused = state === 'paused';
  const isPreview = state === 'preview';
  const isIdle = state === 'idle' || state === 'stopped';
  const canEnterPreview = (isRecording || isPaused) && enablePreview;
  const canSeek = isPreview && duration > 0;

  const seekToFraction = (f: number) => {
    if (!canSeek) return;
    const pos = Math.max(0, Math.min(duration, Math.round(duration * f)));
    ref.current?.seekPreview(pos);
    append(
      `seekPreview(${pos}ms)  // ${Math.round(f * 100)}% of ${duration}ms`
    );
  };

  const seekByMs = (deltaMs: number) => {
    if (!canSeek) return;
    const pos = Math.max(0, Math.min(duration, position + deltaMs));
    ref.current?.seekPreview(pos);
    append(`seekPreview(${pos}ms)  // ${deltaMs >= 0 ? '+' : ''}${deltaMs}ms`);
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
      stateChip: { backgroundColor: theme.surfaceAlt },
      stateChipText: { color: theme.text },
      progressTrack: { backgroundColor: theme.surfaceAlt },
      progressFill: { backgroundColor: theme.accent },
      mono: { color: theme.text },
      monoDim: { color: theme.textDim },
      logBox: { backgroundColor: theme.surfaceAlt },
      logEmpty: { color: theme.textDim },
      logLine: { color: theme.text },
      tip: { color: theme.textDim },
    }),
    [theme]
  );

  const percent = duration > 0 ? position / duration : 0;
  const fillStyle = useMemo<ViewStyle>(
    () => ({
      width: `${Math.round(percent * 100)}%`,
    }),
    [percent]
  );

  return (
    <ScreenContainer style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Preview API</Text>
          <Text style={styles.subtitle}>
            Record something, then drive `enterPreview` / `exitPreview` /
            `togglePreviewPlayback` / `seekPreview` directly from the buttons
            below. The native `WaveformBarsView` already supports scrub gestures
            in preview state — try dragging the waveform too.
          </Text>
        </View>

        <DemoCard
          title="The recorder"
          description="One always-mounted recorder. Cancel resets the session; the bars stay frozen on stop until you start again."
        >
          <WaveformRecorderView
            ref={ref}
            style={recorderStyles.bar}
            enablePreview={enablePreview}
            enableContinueRecording={enableContinue}
            showPlayButton={showPlayButton}
            onStateChange={(e) => {
              setState(e.state);
              append(`onStateChange  state=${e.state}  dur=${e.durationMs}ms`);
              if (e.state !== 'preview') {
                setPosition(0);
                setLastSeek(null);
              }
            }}
            onPlaybackTimeUpdate={(e) => {
              setPosition(e.positionMs);
              setDuration(e.durationMs);
            }}
            onSeek={(e) => {
              setLastSeek(e.positionMs);
              append(`onSeek  positionMs=${e.positionMs}`);
            }}
            onComplete={(e) => {
              setCompletion(
                `${(e.sizeBytes / 1024).toFixed(1)} KB · ${e.durationMs}ms · ${e.format}`
              );
              append(`onComplete  bytes=${e.sizeBytes}  durMs=${e.durationMs}`);
            }}
            onError={(e) => append(`onError  ${e.code ?? ''}  ${e.message}`)}
          />

          <View style={recorderStyles.chipRow}>
            <View style={[recorderStyles.stateChip, themed.stateChip]}>
              <Text
                style={[recorderStyles.stateChipText, themed.stateChipText]}
              >
                state: {state}
              </Text>
            </View>
            {completion ? (
              <View style={[recorderStyles.stateChip, themed.stateChip]}>
                <Text
                  style={[recorderStyles.stateChipText, themed.stateChipText]}
                >
                  last onComplete: {completion}
                </Text>
              </View>
            ) : null}
          </View>
        </DemoCard>

        <DemoCard
          title="Recorder controls"
          description="Standard recording lifecycle. Get into `recording` or `paused` first, then move on to the preview card below."
        >
          <View style={recorderStyles.row}>
            <PillButton
              label="start()"
              variant="primary"
              disabled={!isIdle}
              onPress={() => {
                setEvents([]);
                setCompletion(null);
                ref.current?.start();
              }}
            />
            <PillButton
              label="pause()"
              disabled={!isRecording}
              onPress={() => ref.current?.pause()}
            />
            <PillButton
              label="resume()"
              disabled={!isPaused && !(isPreview && enableContinue)}
              onPress={() => ref.current?.resume()}
            />
            <PillButton
              label="stop()"
              variant="danger"
              disabled={isIdle}
              onPress={() => ref.current?.stop()}
            />
            <PillButton
              label="cancel()"
              disabled={isIdle}
              onPress={() => ref.current?.cancel()}
            />
          </View>
        </DemoCard>

        <DemoCard
          title="Preview commands"
          description="The four imperative methods that drive the preview lifecycle. Buttons grey out when the state machine doesn't allow them."
        >
          <View style={recorderStyles.row}>
            <PillButton
              label="enterPreview()"
              variant="primary"
              disabled={!canEnterPreview}
              onPress={() => {
                ref.current?.enterPreview();
                append('enterPreview() called');
              }}
            />
            <PillButton
              label="exitPreview()"
              disabled={!isPreview}
              onPress={() => {
                ref.current?.exitPreview();
                append('exitPreview() called');
              }}
            />
            <PillButton
              label="togglePreviewPlayback()"
              variant="primary"
              disabled={!isPreview}
              onPress={() => {
                ref.current?.togglePreviewPlayback();
                append('togglePreviewPlayback() called');
              }}
            />
          </View>

          <Text style={[recorderStyles.caption, themed.tip]}>
            From any of `recording` / `paused`, `enterPreview()` auto-pauses +
            finalises the current segment, then snapshots a playable URL
            (single-segment fast path or async concat for multi-segment).
            `exitPreview()` returns to `paused` so you can keep recording.
          </Text>
        </DemoCard>

        <DemoCard
          title="Seek the playhead"
          description="`seekPreview(positionMs)` jumps the player and updates the bars-view fill immediately, independent of the 30 Hz tick."
        >
          <Text style={[recorderStyles.statusLine, themed.statusLine]}>
            position: {position}ms / {duration}ms · {Math.round(percent * 100)}%
            {lastSeek !== null ? `   |   last onSeek: ${lastSeek}ms` : ''}
          </Text>
          <View style={[recorderStyles.progressTrack, themed.progressTrack]}>
            <View
              style={[
                recorderStyles.progressFill,
                themed.progressFill,
                fillStyle,
              ]}
            />
          </View>

          <View style={recorderStyles.row}>
            {[0, 0.25, 0.5, 0.75, 1].map((f) => (
              <PillButton
                key={f}
                label={`${Math.round(f * 100)}%`}
                disabled={!canSeek}
                onPress={() => seekToFraction(f)}
              />
            ))}
          </View>
          <View style={recorderStyles.row}>
            <PillButton
              label="−5s"
              disabled={!canSeek}
              onPress={() => seekByMs(-5000)}
            />
            <PillButton
              label="−1s"
              disabled={!canSeek}
              onPress={() => seekByMs(-1000)}
            />
            <PillButton
              label="+1s"
              disabled={!canSeek}
              onPress={() => seekByMs(1000)}
            />
            <PillButton
              label="+5s"
              disabled={!canSeek}
              onPress={() => seekByMs(5000)}
            />
          </View>
        </DemoCard>

        <DemoCard
          title="Prop toggles"
          description="The two JS knobs that gate the preview flow, plus the built-in play button visibility."
        >
          <View style={recorderStyles.row}>
            <PillButton
              label={`enablePreview: ${enablePreview ? 'on' : 'off'}`}
              variant={enablePreview ? 'primary' : 'neutral'}
              onPress={() => setEnablePreview((v) => !v)}
            />
            <PillButton
              label={`enableContinueRecording: ${enableContinue ? 'on' : 'off'}`}
              variant={enableContinue ? 'primary' : 'neutral'}
              onPress={() => setEnableContinue((v) => !v)}
            />
            <PillButton
              label={`showPlayButton: ${showPlayButton ? 'on' : 'off'}`}
              variant={showPlayButton ? 'primary' : 'neutral'}
              onPress={() => setShowPlayButton((v) => !v)}
            />
          </View>
          <Text style={[recorderStyles.caption, themed.tip]}>
            With `enablePreview` off, `enterPreview()` is rejected and fires
            `onError` with code `preview-disabled`. With
            `enableContinueRecording` off, `resume()` from preview is a no-op —
            useful when preview means "review before send" and you don't want
            users editing further.
          </Text>
        </DemoCard>

        <DemoCard
          title="Event log"
          description="Newest-first. Cleared on each fresh `start()`."
        >
          <View style={[recorderStyles.logBox, themed.logBox]}>
            {events.length === 0 ? (
              <Text style={[recorderStyles.logEmpty, themed.logEmpty]}>
                (no events yet — press `start()` then `enterPreview()`)
              </Text>
            ) : (
              events.map((line, i) => (
                <Text key={i} style={[recorderStyles.logLine, themed.logLine]}>
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
  row: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  stateChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginRight: 8,
    marginTop: 8,
  },
  stateChipText: { fontSize: 12, fontFamily: 'Menlo', fontWeight: '600' },
  caption: { fontSize: 11, marginTop: 12, lineHeight: 16 },
  statusLine: { fontSize: 12, marginTop: 4, fontFamily: 'Menlo' },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  logBox: { padding: 10, borderRadius: 10, minHeight: 120 },
  logEmpty: { fontSize: 12 },
  logLine: { fontSize: 11, fontFamily: 'Menlo' },
});
