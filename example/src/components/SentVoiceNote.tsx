import { useCallback, useState } from 'react';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';
import { AudioWaveformView } from 'react-native-waveform-player';
import type { WaveformRecorderCompleteEvent } from 'react-native-waveform-recorder';

/**
 * In-memory voice-note record kept per-recipe. We deliberately don't
 * persist between mounts so opening any recipe gives a clean state, per
 * product direction — the demo's point is "look at the pairing", not
 * "build a real outbox".
 */
export type VoiceNote = {
  id: string;
  uri: string;
  /** 64-bucket normalised peaks in [0, 1]. Comes straight from the recorder's
   *  `onComplete.samples` field; passing it to the player as `samples` lets
   *  it skip the native decode pass entirely. */
  samples: number[];
  durationMs: number;
  sizeBytes: number;
};

/**
 * Hook used by every chat-style recipe. Owns the in-memory list of voice
 * notes recorded during this mount. The callback returned in `add` is
 * shaped to drop straight into the recorder view's `onComplete` prop.
 */
export function useSentVoiceNotes() {
  const [notes, setNotes] = useState<VoiceNote[]>([]);
  const add = useCallback((event: WaveformRecorderCompleteEvent) => {
    setNotes((prev) => [
      ...prev,
      {
        // `uri` is unique enough as a session-local id; multiple recordings
        // produce distinct tmp paths.
        id: event.uri,
        uri: event.uri,
        samples: event.samples,
        durationMs: event.durationMs,
        sizeBytes: event.sizeBytes,
      },
    ]);
  }, []);
  const clear = useCallback(() => setNotes([]), []);
  return { notes, add, clear } as const;
}

type Theme = {
  /** Pill background. */
  containerBackgroundColor: ColorValue;
  /** Played-portion bar color. */
  playedBarColor: ColorValue;
  /** Unplayed-portion bar color (`rgba(...,0.x)` reads well over the pill). */
  unplayedBarColor: ColorValue;
  /** Play button + time label color. */
  foregroundColor: ColorValue;
  /** Speed pill text color (defaults to `foregroundColor`). */
  speedColor?: ColorValue;
  /** Speed pill background (defaults to a faded `unplayedBarColor`). */
  speedBackgroundColor?: ColorValue;
};

/**
 * Themable voice-note bubble backed by `AudioWaveformView` from
 * `react-native-waveform-player`. Recipes pass per-app colors so the
 * bubble keeps the brand look while the rendering primitives stay shared.
 *
 * `samples` from `WaveformRecorderCompleteEvent` is fed in directly so
 * the player skips its native decode pass — this also means the very
 * first bubble paints instantly with no spinner, which makes the
 * "recorder → player" handoff feel native.
 *
 * The native `AudioWaveformView` is rendered **without a wrapper `View`**
 * on purpose: wrapping it and giving the wrapper `height: N` plus a
 * `flex: 1` child does not always reach the native side as a layout
 * constraint (the WhatsApp bubble showed up as a tall empty pill).
 * Applying `height` directly to the native style works on both
 * platforms.
 */
export function SentVoiceNote({
  note,
  theme,
  style,
  height = 56,
  containerBorderRadius = 18,
  showSpeedControl = true,
  showTime = true,
}: {
  note: VoiceNote;
  theme: Theme;
  style?: StyleProp<ViewStyle>;
  height?: number;
  /** Inner pill rounding, drawn natively by the player. */
  containerBorderRadius?: number;
  showSpeedControl?: boolean;
  showTime?: boolean;
}) {
  return (
    <AudioWaveformView
      source={{ uri: note.uri }}
      samples={note.samples}
      style={[{ height }, style]}
      containerBackgroundColor={theme.containerBackgroundColor}
      containerBorderRadius={containerBorderRadius}
      playedBarColor={theme.playedBarColor}
      unplayedBarColor={theme.unplayedBarColor}
      playButtonColor={theme.foregroundColor}
      timeColor={theme.foregroundColor}
      showTime={showTime}
      showSpeedControl={showSpeedControl}
      speedColor={theme.speedColor ?? theme.foregroundColor}
      speedBackgroundColor={
        theme.speedBackgroundColor ?? 'rgba(255,255,255,0.18)'
      }
      speeds={[1, 1.5, 2]}
    />
  );
}
