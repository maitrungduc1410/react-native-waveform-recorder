import type { ColorValue, ViewProps } from 'react-native';

/**
 * State reported by `onStateChange`.
 *
 *  - `'idle'`: nothing recorded yet, or the session was cancelled.
 *  - `'recording'`: the microphone is live and bars are being drawn.
 *  - `'paused'`: recording is paused. Also reported after `exitPreview()`.
 *  - `'preview'`: the recorded audio is loaded into the built-in player.
 *  - `'stopped'`: the file is finalised and `onComplete` has fired.
 *  - `'error'`: the recorder failed to start or resume. `onError` has the details.
 */
export type WaveformRecorderState =
  | 'idle'
  | 'recording'
  | 'paused'
  | 'preview'
  | 'stopped'
  | 'error';

/**
 * `'count-up'` shows elapsed time. `'count-down'` shows the time left until
 * `maxDurationMs` while recording (and the time left in the file during
 * preview); without `maxDurationMs` it counts up.
 */
export type WaveformRecorderTimeMode = 'count-up' | 'count-down';

/**
 * Audio container/encoder used for the recorded file.
 *
 *  - `'m4a'` (default): AAC inside an MPEG-4 container. Universally
 *    supported. Best balance of size and quality.
 *  - `'aac'`: the same AAC encoder; the file is still an `.m4a` container,
 *    since raw AAC ADTS is rarely useful in app code.
 *  - `'wav'`: 16-bit linear PCM (RIFF/WAVE) with a canonical 44-byte header.
 *    Largest files, lossless. Required for raw PCM streaming.
 *  - `'opus'`: Opus codec. Needs Android 10 (API 29) or later; on older
 *    Android versions the engine records AAC instead and fires
 *    `onError({ code: 'format-unsupported' })`. The container differs by
 *    platform: `.ogg` on Android (`audio/ogg`) and `.caf` on iOS
 *    (`audio/opus`). Check `onComplete.mimeType` and `onComplete.uri`.
 */
export type WaveformRecorderOutputFormat = 'm4a' | 'aac' | 'wav' | 'opus';

/**
 * How new bars enter the view. Only `'scroll'` is implemented today;
 * `'morph'` and `'centered'` are accepted and render like `'scroll'`.
 */
export type WaveformRecorderRecordingMode = 'scroll' | 'morph' | 'centered';

/** Placeholder drawn in the empty slots that no sample has filled yet. */
export type WaveformRecorderFutureBarStyle = 'dot' | 'line' | 'hidden';

/**
 * Entry animation for a new bar. The native views currently always use
 * the `'grow'` animation; `'fade'` and `'none'` are accepted but have no
 * visible effect yet.
 */
export type WaveformRecorderNewSampleEntry = 'grow' | 'fade' | 'none';

/** Shape of the `output` prop. Every field is optional. */
export type WaveformRecorderOutputConfig = {
  /**
   * `file://` URI to write the recording to. Omit it to let the library
   * pick a file in the app's cache directory. Recordings with several
   * segments are delivered as a new file in the cache directory instead.
   */
  uri?: string;
  /** Default: `'m4a'`. */
  format?: WaveformRecorderOutputFormat;
  /** Sample rate in Hz. Default: `44100`. */
  sampleRate?: number;
  /** Default: `1`. */
  channels?: 1 | 2;
  /**
   * Encoder bitrate in bits per second. Ignored for `'wav'`. On Android the
   * value is clamped to a range that depends on `quality`.
   * Default: `128000`.
   */
  bitrate?: number;
  /** Default: `'high'`. */
  quality?: 'low' | 'medium' | 'high';
};

/** Payload of `onStateChange`. */
export type WaveformRecorderStateChangeEvent = {
  state: WaveformRecorderState;
  /** Recorded duration so far, in ms (time spent paused is not counted). */
  durationMs: number;
};

/** Payload of `onMeter`, fired `meterUpdatesPerSecond` times per second while recording. */
export type WaveformRecorderMeterEvent = {
  /** Current level in [0, 1], the value used to draw the bars. */
  amplitude: number;
  /** Highest `amplitude` seen since the session started, in [0, 1]. */
  peak: number;
  /** Current level in dBFS (0 is full scale, more negative is quieter). */
  db: number;
};

/** Payload of `onComplete`, fired once the final file is on disk. */
export type WaveformRecorderCompleteEvent = {
  /** `file://` URI of the recording. */
  uri: string;
  /** Recorded duration in ms, summed over all segments. */
  durationMs: number;
  format: WaveformRecorderOutputFormat;
  mimeType: string;
  sizeBytes: number;
  sampleRate: number;
  channels: number;
  /**
   * 64 values in [0, 1] that summarise the whole recording, normalised so
   * the loudest bucket is 1. Pass them to a waveform player as
   * pre-computed peaks.
   */
  samples: number[];
  /** Highest meter amplitude seen during the session, in [0, 1]. */
  peakAmplitude: number;
};

/** Payload of `onError`. */
export type WaveformRecorderErrorEvent = {
  message: string;
  /**
   * Machine-readable origin, for example `'start'`, `'session'`, `'resume'`,
   * `'concat'`, `'min-duration'`, `'preview-disabled'`,
   * `'continue-disabled'`, `'preview-snapshot'`, `'preview-load'`,
   * `'format-unsupported'`, `'pcm-stream'`, `'background-capability'` or
   * `'media-recorder'`.
   */
  code?: string;
};

/** Payload of `onSeek`, fired when the preview playhead jumps (scrub or `seekPreview()`). */
export type WaveformRecorderSeekEvent = {
  positionMs: number;
};

/** Payload of `onPlaybackTimeUpdate`, fired about 30 times per second while preview audio plays. */
export type WaveformRecorderPlaybackTimeUpdateEvent = {
  positionMs: number;
  durationMs: number;
};

/**
 * Payload of `onSlideProgress`, fired while the user drags on the recorder
 * during `recording` with `enableSlideToCancel` and/or `enableSlideToLock`
 * on. Use it to animate your own cancel and lock hints.
 */
export type WaveformRecorderSlideProgressEvent = {
  /** 0 = no drag to the left; 1 = dragged `slideToCancelThresholdDp` to the left. */
  cancelProgress: number;
  /** 0 = no upward drag; 1 = dragged `slideToLockThresholdDp` upward. */
  lockProgress: number;
};

/**
 * Payload of `onSilenceDetected`, fired once the level has stayed below
 * `silenceThresholdDb` for at least `silenceTimeoutMs` while recording.
 */
export type WaveformRecorderSilenceDetectedEvent = {
  /** How long the input has been below the threshold, in ms. */
  durationMs: number;
};

/**
 * Payload of `onPcmChunk` while raw PCM streaming is active.
 * `chunk` is base64-encoded little-endian 16-bit PCM. Decode it with
 * `decodePcmChunk` from `react-native-waveform-recorder/pcm-stream`.
 */
export type WaveformRecorderPcmChunkEvent = {
  chunk: string;
  sampleRate: number;
  channels: number;
  /** Bytes per sample per channel. Always 2 (Int16). */
  bytesPerSample: number;
  /** Recorded time when this chunk was flushed, in ms. */
  timestampMs: number;
};

/** Props of {@link WaveformRecorderView}. Standard `View` props such as `style` are accepted too. */
export type WaveformRecorderViewProps = Omit<ViewProps, 'children'> & {
  /**
   * Recording output: file location, format, sample rate, channels,
   * bitrate and quality. See {@link WaveformRecorderOutputConfig} and
   * {@link WaveformRecorderOutputFormat} for per-format caveats.
   */
  output?: WaveformRecorderOutputConfig;
  /**
   * Stop automatically once this much audio is recorded:
   * `onMaxDurationReached` fires, then the file is finalised and
   * `onComplete` fires. `0` means no limit.
   * Default: `0`.
   */
  maxDurationMs?: number;
  /**
   * When `stop()` is called while recording or paused with less audio than
   * this, the recording is discarded instead: the state returns to `idle`
   * and `onError` fires with code `'min-duration'`. `0` disables the check.
   * Default: `0`.
   */
  minDurationMs?: number;

  /**
   * Color of the bars while recording, and of the played part of the bars
   * during preview.
   * Default: white.
   */
  playedBarColor?: ColorValue;
  /**
   * Color of the part of the bars that has not been played yet during preview.
   * Default: white at 50% opacity.
   */
  unplayedBarColor?: ColorValue;
  /**
   * Color of the `futureBarStyle` placeholders.
   * Default: `unplayedBarColor` with reduced opacity.
   */
  futureBarColor?: ColorValue;

  /** Bar width in dp/points. Default: `3`. */
  barWidth?: number;
  /** Space between bars in dp/points. Default: `2`. */
  barGap?: number;
  /** Bar corner radius. A negative value means `barWidth / 2`. Default: `-1`. */
  barRadius?: number;

  /** Background color of the pill. Default: `#3478F6`. */
  containerBackgroundColor?: ColorValue;
  /** Corner radius of the pill. Default: `16`. */
  containerBorderRadius?: number;
  /** Draw the pill background. Default: `true`. */
  showBackground?: boolean;

  /** Show the `m:ss` time label on the right. Default: `true`. */
  showTime?: boolean;
  /** Default: white. */
  timeColor?: ColorValue;
  /** Default: `'count-up'`. */
  timeMode?: WaveformRecorderTimeMode;

  /**
   * How new samples enter the bar field. Only `'scroll'` is implemented.
   * Default: `'scroll'`.
   */
  recordingMode?: WaveformRecorderRecordingMode;
  /**
   * What to draw in the empty slots on the left while the live ribbon has
   * not filled the view yet. `'hidden'` draws nothing (WhatsApp, Slack and
   * Messenger style); `'dot'` and `'line'` draw placeholder ticks
   * (Instagram and Zalo style).
   * Default: `'hidden'`.
   */
  futureBarStyle?: WaveformRecorderFutureBarStyle;
  /**
   * Entry animation for new bars. Currently every value renders the grow-in
   * animation. Default: `'grow'`.
   */
  newSampleEntry?: WaveformRecorderNewSampleEntry;
  /**
   * How many times per second the engine reads the microphone level and
   * fires `onMeter`. Clamped to 1 to 120.
   * Default: `30`.
   */
  meterUpdatesPerSecond?: number;
  /**
   * How many bars per second are added to the waveform. A bar is added on a
   * meter tick, so the effective rate cannot exceed `meterUpdatesPerSecond`.
   * Default: `12`.
   */
  samplesPerSecond?: number;

  /**
   * When `false`, `enterPreview()` does nothing and fires `onError` with
   * code `'preview-disabled'`.
   * Default: `true`.
   */
  enablePreview?: boolean;
  /**
   * When `false`, `resume()` from preview does nothing and fires `onError`
   * with code `'continue-disabled'`.
   * Default: `true`.
   */
  enableContinueRecording?: boolean;
  /** Show the built-in play/pause button during preview. Default: `true`. */
  showPlayButton?: boolean;
  /** Default: white. */
  playButtonColor?: ColorValue;

  /**
   * Track a drag on the recorder view while recording. Dragging
   * `slideToCancelThresholdDp` to the left fires `onSlideCancel` once.
   * The library does not cancel by itself: call `cancel()` in the handler.
   * Default: `false`.
   */
  enableSlideToCancel?: boolean;
  /** Horizontal distance in dp/points. Default: `80`. */
  slideToCancelThresholdDp?: number;
  /**
   * Track a drag on the recorder view while recording. Dragging
   * `slideToLockThresholdDp` upward fires `onSlideLock` once.
   * Default: `false`.
   */
  enableSlideToLock?: boolean;
  /** Vertical distance in dp/points. Default: `80`. */
  slideToLockThresholdDp?: number;

  /**
   * Emit raw 16-bit PCM through `onPcmChunk` while recording.
   * **Only works with `output.format = 'wav'`**; other formats ignore it.
   * Decode the payload with the helpers in
   * `react-native-waveform-recorder/pcm-stream`.
   * Default: `false`.
   */
  enablePcmStream?: boolean;
  /**
   * Approximate chunk duration in ms. The native engine flushes chunks at
   * or near this cadence (minimum 20).
   * Default: `200`.
   */
  pcmChunkMs?: number;

  /**
   * Keep recording while the app is in the background.
   *
   * iOS: add `audio` to `UIBackgroundModes` in `Info.plist`. If it is
   * missing, `onError` fires once with code `'background-capability'`.
   *
   * Android: declare the
   * `com.waveformrecorder.WaveformRecorderBackgroundService` service in
   * `AndroidManifest.xml`. The library already merges the
   * `FOREGROUND_SERVICE` and `FOREGROUND_SERVICE_MICROPHONE` permissions.
   * While recording, a microphone-type foreground service with a
   * notification keeps the microphone alive.
   *
   * The Expo config plugin does both when its `backgroundRecording`
   * option is `true`.
   * Default: `false`.
   */
  backgroundRecording?: boolean;
  /** Android only: title of the foreground-service notification. Default: `'Recording'`. */
  backgroundNotificationTitle?: string;
  /**
   * Android only: text of the foreground-service notification.
   * Default: `'Microphone recording in progress.'`
   */
  backgroundNotificationBody?: string;

  /**
   * Level in dBFS below which the input counts as silent, for example `-50`.
   * The default `-160` never triggers, so set both this and
   * `silenceTimeoutMs` to enable silence detection.
   * Default: `-160`.
   */
  silenceThresholdDb?: number;
  /**
   * How long the input must stay below `silenceThresholdDb` before
   * `onSilenceDetected` fires. `0` disables silence detection.
   * Default: `0`.
   */
  silenceTimeoutMs?: number;
  /** Stop and finalise the recording when silence is detected. Default: `false`. */
  autoStopOnSilence?: boolean;

  /**
   * Controlled mode (experimental). When set, ref methods no longer run
   * transitions; they only fire `onStateChange` with the requested state.
   * Note that in the current native implementation, changing this prop
   * does not start or stop recording either, so prefer the ref methods.
   */
  state?: WaveformRecorderState;

  /** Fires on every state transition. */
  onStateChange?: (event: WaveformRecorderStateChangeEvent) => void;
  /** Fires `meterUpdatesPerSecond` times per second while recording. */
  onMeter?: (event: WaveformRecorderMeterEvent) => void;
  /** Fires once the final file is written after `stop()` (or an automatic stop). */
  onComplete?: (event: WaveformRecorderCompleteEvent) => void;
  /** Fires when `maxDurationMs` is reached, right before the automatic stop. */
  onMaxDurationReached?: () => void;
  /** Fires when `start()` cannot get microphone permission. */
  onPermissionDenied?: () => void;
  /** Fires for warnings and failures. See {@link WaveformRecorderErrorEvent.code}. */
  onError?: (event: WaveformRecorderErrorEvent) => void;
  /** Fires when the preview playhead jumps (end of a scrub, or `seekPreview()`). */
  onSeek?: (event: WaveformRecorderSeekEvent) => void;
  /** Fires about 30 times per second while preview audio plays. */
  onPlaybackTimeUpdate?: (
    event: WaveformRecorderPlaybackTimeUpdateEvent
  ) => void;
  /** Fires while the user drags on the recorder during recording. */
  onSlideProgress?: (event: WaveformRecorderSlideProgressEvent) => void;
  /** Fires once per drag when the slide-to-cancel threshold is crossed. */
  onSlideCancel?: () => void;
  /** Fires once per drag when the slide-to-lock threshold is crossed. */
  onSlideLock?: () => void;
  /** Fires once per silent stretch while recording. */
  onSilenceDetected?: (event: WaveformRecorderSilenceDetectedEvent) => void;
  /** Fires about every `pcmChunkMs` while raw PCM streaming is active. */
  onPcmChunk?: (event: WaveformRecorderPcmChunkEvent) => void;
};

/** Methods available on the `ref` of {@link WaveformRecorderView}. */
export type WaveformRecorderViewRef = {
  /**
   * Start a new recording. Requests microphone permission first and fires
   * `onPermissionDenied` if it is refused. From `paused` it resumes instead.
   */
  start: () => void;
  /** Pause the current recording. Only acts in `recording`. */
  pause: () => void;
  /**
   * Continue recording. From `paused` the same segment continues; from
   * `preview` the player stops and a new segment starts (the "continue
   * recording" flow). Disabled from preview by
   * `enableContinueRecording={false}`.
   */
  resume: () => void;
  /**
   * Finalise the recording, join the segments and fire `onComplete`.
   * See `minDurationMs` for the short-recording check.
   */
  stop: () => void;
  /**
   * Discard the session, delete its segment files and return to `idle`.
   * `onComplete` does not fire. Called after `stop()`, this can also delete
   * the file that `onComplete` delivered, so copy it first if you need it.
   */
  cancel: () => void;
  /**
   * Pause (if needed) and load everything recorded so far into the
   * built-in player. The state becomes `preview` once the audio is ready.
   */
  enterPreview: () => void;
  /** Leave preview and return to `paused`, ready for `resume()` or `stop()`. */
  exitPreview: () => void;
  /** Play or pause the preview audio. Only acts in `preview`. */
  togglePreviewPlayback: () => void;
  /** Move the preview playhead to `positionMs`. Only acts in `preview`. */
  seekPreview: (positionMs: number) => void;
};
