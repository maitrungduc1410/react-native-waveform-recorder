import { forwardRef, type ForwardedRef } from 'react';
import type { ColorValue, ViewProps } from 'react-native';

export type WaveformRecorderState =
  | 'idle'
  | 'recording'
  | 'paused'
  | 'preview'
  | 'stopped'
  | 'error';

export type WaveformRecorderTimeMode = 'count-up' | 'count-down';

/**
 * Audio container/encoder used for the recorded file.
 *
 *  - `'m4a'` (default) — AAC inside an MPEG-4 container. Universally
 *    supported. Best balance of size and quality.
 *  - `'aac'` — Same encoder as `m4a`, library still wraps the output in
 *    `m4a` since raw AAC ADTS is rarely useful in app code.
 *  - `'wav'` — 16-bit linear PCM (RIFF/WAVE). Largest files, lossless.
 *    Library writes a canonical 44-byte header.
 *  - `'opus'` — Opus codec. **OS-version gated:** requires iOS 11+ /
 *    Android 10 (API 29)+. On older systems the engine falls back to
 *    AAC/`m4a` and fires `onError({ code: 'format-unsupported' })`.
 *    The container differs by platform — `.ogg` on Android (OGG/OPUS) and
 *    `.caf` on iOS (`kAudioFormatOpus` inside an Apple Core Audio
 *    Format). Inspect `onComplete.mimeType` (`audio/ogg` vs
 *    `audio/opus`) and `onComplete.uri` for the platform-specific output.
 */
export type WaveformRecorderOutputFormat = 'm4a' | 'aac' | 'wav' | 'opus';

export type WaveformRecorderRecordingMode = 'scroll' | 'morph' | 'centered';

export type WaveformRecorderFutureBarStyle = 'dot' | 'line' | 'hidden';

export type WaveformRecorderNewSampleEntry = 'grow' | 'fade' | 'none';

export type WaveformRecorderOutputConfig = {
  uri?: string;
  format?: WaveformRecorderOutputFormat;
  sampleRate?: number;
  channels?: 1 | 2;
  bitrate?: number;
  quality?: 'low' | 'medium' | 'high';
};

export type WaveformRecorderStateChangeEvent = {
  state: WaveformRecorderState;
  durationMs: number;
};

export type WaveformRecorderMeterEvent = {
  amplitude: number;
  peak: number;
  db: number;
};

export type WaveformRecorderCompleteEvent = {
  uri: string;
  durationMs: number;
  format: WaveformRecorderOutputFormat;
  mimeType: string;
  sizeBytes: number;
  sampleRate: number;
  channels: number;
  /** WhatsApp-compatible 64-bucket sample array, values in [0, 1]. */
  samples: number[];
  peakAmplitude: number;
};

export type WaveformRecorderErrorEvent = {
  message: string;
  code?: string;
};

/** v0.2 — fired when the preview playhead jumps (scrub or imperative seek). */
export type WaveformRecorderSeekEvent = {
  positionMs: number;
};

/** v0.2 — fired periodically while the preview player is running. */
export type WaveformRecorderPlaybackTimeUpdateEvent = {
  positionMs: number;
  durationMs: number;
};

/**
 * v0.3 — fired continuously while a recording-mode pan gesture is active. Use
 * the progress values (clamped to [0, 1]) to drive your mic-button chevron
 * follow-along animation. Fires only while the component is in `recording`
 * state and `enableSlideToCancel` and/or `enableSlideToLock` is on.
 */
export type WaveformRecorderSlideProgressEvent = {
  /** 0 = no horizontal drag; 1 = passed `slideToCancelThresholdDp` to the left. */
  cancelProgress: number;
  /** 0 = no vertical drag; 1 = passed `slideToLockThresholdDp` upward. */
  lockProgress: number;
};

/**
 * v0.3 — fired when the rolling mean dB level stays below
 * `silenceThresholdDb` for at least `silenceTimeoutMs` while recording.
 */
export type WaveformRecorderSilenceDetectedEvent = {
  /** How long the rolling level has been below threshold, in ms. */
  durationMs: number;
};

/**
 * v1.0 — payload of `onPcmChunk` while raw-PCM streaming is active.
 * `chunk` is base64-encoded little-endian 16-bit PCM. Decode it with the
 * helper exported from `react-native-waveform-recorder/pcm-stream`.
 */
export type WaveformRecorderPcmChunkEvent = {
  chunk: string;
  sampleRate: number;
  channels: number;
  /** Bytes per sample per channel. Always 2 in v1.0 (Int16). */
  bytesPerSample: number;
  /** Elapsed recording time when this chunk was flushed. */
  timestampMs: number;
};

export type WaveformRecorderViewProps = Omit<ViewProps, 'children'> & {
  /**
   * Recording output configuration. Library writes to a cache-dir path when
   * `uri` is omitted. `format` accepts `'m4a' | 'aac' | 'wav' | 'opus'` —
   * see {@link WaveformRecorderOutputFormat} for per-format caveats.
   */
  output?: WaveformRecorderOutputConfig;
  /** Stop automatically after this many ms (and fire `onMaxDurationReached`). */
  maxDurationMs?: number;
  /** Reject `stop()` calls before this many ms have elapsed. */
  minDurationMs?: number;

  /** Highlighted bar color (the recorded amplitude). */
  playedBarColor?: ColorValue;
  /** Bar color for the not-yet-recorded portion. */
  unplayedBarColor?: ColorValue;
  /** Dotted future-bar color. Defaults to a faded version of `unplayedBarColor`. */
  futureBarColor?: ColorValue;

  barWidth?: number;
  barGap?: number;
  /** -1 / undefined = auto (barWidth / 2). */
  barRadius?: number;

  containerBackgroundColor?: ColorValue;
  containerBorderRadius?: number;
  showBackground?: boolean;

  showTime?: boolean;
  timeColor?: ColorValue;
  /** count-up: 0:00 -> N. count-down: maxDurationMs -> 0:00. */
  timeMode?: WaveformRecorderTimeMode;

  /** How new samples enter the bar field. v0.1: only 'scroll' is implemented. */
  recordingMode?: WaveformRecorderRecordingMode;
  /**
   * What to render in the un-recorded portion of the view (the slots to
   * the left/right of the live ribbon while recording).
   *
   * Defaults to `'hidden'` — matching WhatsApp / Slack / Messenger, which
   * show nothing until the first real amplitude arrives. Set to `'dot'`
   * or `'line'` to draw placeholder ticks (Instagram / Zalo style).
   */
  futureBarStyle?: WaveformRecorderFutureBarStyle;
  /** Per-bar entry animation as a new sample arrives. */
  newSampleEntry?: WaveformRecorderNewSampleEntry;
  /** How many times per second the engine polls the mic amplitude. */
  meterUpdatesPerSecond?: number;
  /** Visual bar throughput (bars per second appearing on screen). */
  samplesPerSecond?: number;

  // ---------- v0.2: preview integration ----------
  /** When false, `enterPreview()` is a no-op. Default `true`. */
  enablePreview?: boolean;
  /**
   * When false, `resume()` from preview is a no-op (locks out the WhatsApp /
   * Messenger "continue recording" gesture). Default `true`.
   */
  enableContinueRecording?: boolean;
  /** Show the built-in play/pause button during preview state. Default `true`. */
  showPlayButton?: boolean;
  playButtonColor?: ColorValue;

  // ---------- v0.3: recording-mode gestures ----------
  /**
   * Attach a native pan gesture to the recorder view while in `recording`
   * state. When the user drags horizontally past `slideToCancelThresholdDp`
   * to the left, `onSlideCancel` fires once. Default `false`.
   */
  enableSlideToCancel?: boolean;
  /** Horizontal threshold in dp/points. Default `80`. */
  slideToCancelThresholdDp?: number;
  /**
   * Attach a native pan gesture to the recorder view while in `recording`
   * state. When the user drags upward past `slideToLockThresholdDp`,
   * `onSlideLock` fires once. Default `false`.
   */
  enableSlideToLock?: boolean;
  /** Vertical threshold in dp/points. Default `80`. */
  slideToLockThresholdDp?: number;

  // ---------- v1.0: raw-PCM streaming (opt-in) ----------
  /**
   * When true, the engine emits chunks of raw 16-bit PCM via `onPcmChunk`
   * while recording. **Only works with `output.format = 'wav'`** — other
   * formats don't expose pre-encoded samples. Subscribe via the
   * `react-native-waveform-recorder/pcm-stream` subpath import, which
   * ships a decoder helper for the base64 payload.
   */
  enablePcmStream?: boolean;
  /**
   * Approximate target chunk duration in ms. The native engine flushes
   * chunks at or near this cadence. Default `200`.
   */
  pcmChunkMs?: number;

  // ---------- v1.0: background recording ----------
  /**
   * When true, the recorder keeps running while the host app is
   * backgrounded.
   *
   * iOS: the host app must add `audio` to `UIBackgroundModes` in
   * `Info.plist`. The engine already configures `AVAudioSession` as
   * `.playAndRecord`, which is sufficient to keep the mic alive.
   *
   * Android: the host app must declare the
   * `com.waveformrecorder.WaveformRecorderBackgroundService` service in
   * `AndroidManifest.xml` and add `FOREGROUND_SERVICE` +
   * `FOREGROUND_SERVICE_MICROPHONE` permissions. The native engine binds
   * a microphone-type foreground service for the duration of recording
   * so the OS doesn't suspend the mic while the user is in another app.
   */
  backgroundRecording?: boolean;
  /** Optional title for the Android foreground-service notification. */
  backgroundNotificationTitle?: string;
  /** Optional body for the Android foreground-service notification. */
  backgroundNotificationBody?: string;

  // ---------- v0.3: silence detection ----------
  /**
   * dBFS threshold for silence detection (negative number, e.g. `-50`).
   * When the rolling mean dB stays below this for `silenceTimeoutMs`,
   * `onSilenceDetected` fires. `-160` (default) effectively disables it.
   */
  silenceThresholdDb?: number;
  /**
   * Minimum window of silence (in ms) before `onSilenceDetected` fires.
   * `0` (default) effectively disables silence detection.
   */
  silenceTimeoutMs?: number;
  /** When true, the engine auto-stops recording when silence is detected. Default `false`. */
  autoStopOnSilence?: boolean;

  /**
   * Controlled state. When set (not `undefined`), the component is fully
   * controlled — internal commands fire `onStateChange` with the *requested*
   * new state but do not mutate the component's state. Update the prop in
   * your parent state to advance the machine.
   */
  state?: WaveformRecorderState;

  onStateChange?: (event: WaveformRecorderStateChangeEvent) => void;
  onMeter?: (event: WaveformRecorderMeterEvent) => void;
  onComplete?: (event: WaveformRecorderCompleteEvent) => void;
  onMaxDurationReached?: () => void;
  onPermissionDenied?: () => void;
  onError?: (event: WaveformRecorderErrorEvent) => void;
  /** v0.2 — fired when the preview playhead moves (scrub or imperative seek). */
  onSeek?: (event: WaveformRecorderSeekEvent) => void;
  /** v0.2 — fired periodically while preview playback is active. */
  onPlaybackTimeUpdate?: (
    event: WaveformRecorderPlaybackTimeUpdateEvent
  ) => void;
  /** v0.3 — pan gesture progress while recording. */
  onSlideProgress?: (event: WaveformRecorderSlideProgressEvent) => void;
  /** v0.3 — fired once when the slide-to-cancel threshold is crossed. */
  onSlideCancel?: () => void;
  /** v0.3 — fired once when the slide-to-lock threshold is crossed. */
  onSlideLock?: () => void;
  /** v0.3 — fired when sustained silence is detected during recording. */
  onSilenceDetected?: (event: WaveformRecorderSilenceDetectedEvent) => void;
  /** v1.0 — fired periodically while raw-PCM streaming is active. */
  onPcmChunk?: (event: WaveformRecorderPcmChunkEvent) => void;
};

export type WaveformRecorderViewRef = {
  start: () => void;
  pause: () => void;
  /**
   * Continue recording from `paused` or `preview` state. Appends to the same
   * file when called from `paused`; from `preview` it stops the preview
   * playback first then resumes recording (WhatsApp / Messenger "continue
   * recording" gesture). No-op when `enableContinueRecording={false}`.
   */
  resume: () => void;
  stop: () => void;
  cancel: () => void;
  /** v0.2 — Enter preview state. Starts a player on the recorded-so-far file. */
  enterPreview: () => void;
  /** v0.2 — Leave preview state. Returns to `paused`. */
  exitPreview: () => void;
  /** v0.2 — Play / pause the preview player. */
  togglePreviewPlayback: () => void;
  /** v0.2 — Seek the preview playhead to `positionMs`. */
  seekPreview: (positionMs: number) => void;
};

function WaveformRecorderViewInner(
  _props: WaveformRecorderViewProps,
  _ref: ForwardedRef<WaveformRecorderViewRef>
): never {
  throw new Error(
    "'react-native-waveform-recorder' is only supported on native platforms."
  );
}

export const WaveformRecorderView = forwardRef<
  WaveformRecorderViewRef,
  WaveformRecorderViewProps
>(WaveformRecorderViewInner);

WaveformRecorderView.displayName = 'WaveformRecorderView';

/**
 * Web stub — always resolves `false` since browser-side recording isn't
 * supported by this library.
 */
export async function ensureMicrophonePermission(): Promise<boolean> {
  return false;
}
