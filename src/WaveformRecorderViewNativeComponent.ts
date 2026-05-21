import {
  codegenNativeComponent,
  codegenNativeCommands,
  type CodegenTypes,
  type ColorValue,
  type HostComponent,
  type ViewProps,
} from 'react-native';

type OnStateChangeEvent = Readonly<{
  state: string;
  durationMs: CodegenTypes.Int32;
}>;

type OnMeterEvent = Readonly<{
  amplitude: CodegenTypes.Float;
  peak: CodegenTypes.Float;
  db: CodegenTypes.Float;
}>;

type OnCompleteEvent = Readonly<{
  uri: string;
  durationMs: CodegenTypes.Int32;
  format: string;
  mimeType: string;
  sizeBytes: CodegenTypes.Int32;
  sampleRate: CodegenTypes.Int32;
  channels: CodegenTypes.Int32;
  /**
   * Comma-separated 64-bucket WhatsApp-compatible amplitude string, each
   * value in [0, 1]. Codegen DirectEvent payloads do not support arrays;
   * the JS wrapper parses this into `samples: number[]` before invoking
   * the public `onComplete` callback.
   */
  samplesCsv: string;
  peakAmplitude: CodegenTypes.Float;
}>;

type OnMaxDurationReachedEvent = Readonly<{}>;

type OnPermissionDeniedEvent = Readonly<{}>;

type OnErrorEvent = Readonly<{
  message: string;
  code: string;
}>;

/** v0.2 — fired when the preview playhead moves (via scrub or imperative seek). */
type OnSeekEvent = Readonly<{
  positionMs: CodegenTypes.Int32;
}>;

/** v0.2 — fired periodically while preview playback is active. */
type OnPlaybackTimeUpdateEvent = Readonly<{
  positionMs: CodegenTypes.Int32;
  durationMs: CodegenTypes.Int32;
}>;

/**
 * v0.3 — fired continuously while a recording-mode pan gesture is active so
 * the host UI can animate a chevron / mic-button follow-along. Values are
 * clamped to [0, 1] where 1 means the threshold has been reached.
 */
type OnSlideProgressEvent = Readonly<{
  cancelProgress: CodegenTypes.Float;
  lockProgress: CodegenTypes.Float;
}>;

/** v0.3 — fired once when the slide-to-cancel threshold is crossed. */
type OnSlideCancelEvent = Readonly<{}>;

/** v0.3 — fired once when the slide-to-lock threshold is crossed. */
type OnSlideLockEvent = Readonly<{}>;

/** v0.3 — fired when the rolling dB level stays below threshold for too long. */
type OnSilenceDetectedEvent = Readonly<{
  durationMs: CodegenTypes.Int32;
}>;

/**
 * v1.0 — fired periodically while raw-PCM streaming is enabled. `chunk` is
 * base64-encoded little-endian 16-bit PCM samples for the configured
 * number of channels. Subscribe via the `/pcm-stream` import path which
 * exposes a decoder helper for turning the base64 payload back into a
 * typed array.
 */
type OnPcmChunkEvent = Readonly<{
  chunk: string;
  sampleRate: CodegenTypes.Int32;
  channels: CodegenTypes.Int32;
  bytesPerSample: CodegenTypes.Int32;
  timestampMs: CodegenTypes.Int32;
}>;

export interface NativeProps extends ViewProps {
  // ---------- Recording config ----------
  /** Where to write the file. Empty = library picks a cache-dir path. */
  outputUri?: string;
  /** Container/codec. Only 'm4a' is supported in v0.1. */
  outputFormat?: CodegenTypes.WithDefault<
    'm4a' | 'aac' | 'wav' | 'opus',
    'm4a'
  >;
  outputSampleRate?: CodegenTypes.WithDefault<CodegenTypes.Int32, 44100>;
  outputChannels?: CodegenTypes.WithDefault<CodegenTypes.Int32, 1>;
  outputBitrate?: CodegenTypes.WithDefault<CodegenTypes.Int32, 128000>;
  outputQuality?: CodegenTypes.WithDefault<'low' | 'medium' | 'high', 'high'>;

  /** 0 = no max. */
  maxDurationMs?: CodegenTypes.WithDefault<CodegenTypes.Int32, 0>;
  /** 0 = no min. */
  minDurationMs?: CodegenTypes.WithDefault<CodegenTypes.Int32, 0>;

  // ---------- Visual props (mirror player) ----------
  playedBarColor?: ColorValue;
  unplayedBarColor?: ColorValue;
  /** Dotted future-bar color. Defaults to unplayedBarColor when null. */
  futureBarColor?: ColorValue;

  barWidth?: CodegenTypes.WithDefault<CodegenTypes.Float, 3.0>;
  barGap?: CodegenTypes.WithDefault<CodegenTypes.Float, 2.0>;
  /** -1 sentinel = "auto" (barWidth / 2). */
  barRadius?: CodegenTypes.WithDefault<CodegenTypes.Float, -1.0>;

  containerBackgroundColor?: ColorValue;
  containerBorderRadius?: CodegenTypes.WithDefault<CodegenTypes.Float, 16.0>;
  showBackground?: CodegenTypes.WithDefault<boolean, true>;

  showTime?: CodegenTypes.WithDefault<boolean, true>;
  timeColor?: ColorValue;
  timeMode?: CodegenTypes.WithDefault<'count-up' | 'count-down', 'count-up'>;

  // ---------- Recording-specific visual ----------
  recordingMode?: CodegenTypes.WithDefault<
    'scroll' | 'morph' | 'centered',
    'scroll'
  >;
  futureBarStyle?: CodegenTypes.WithDefault<
    'dot' | 'line' | 'hidden',
    'hidden'
  >;
  newSampleEntry?: CodegenTypes.WithDefault<'grow' | 'fade' | 'none', 'grow'>;
  meterUpdatesPerSecond?: CodegenTypes.WithDefault<CodegenTypes.Int32, 30>;
  samplesPerSecond?: CodegenTypes.WithDefault<CodegenTypes.Int32, 12>;

  // ---------- v0.2: preview integration ----------
  /** When false, `enterPreview()` is a no-op. */
  enablePreview?: CodegenTypes.WithDefault<boolean, true>;
  /** When false, `resume()` from preview is a no-op (WhatsApp-style continue is gated off). */
  enableContinueRecording?: CodegenTypes.WithDefault<boolean, true>;
  /** Show the built-in play/pause button during preview state. */
  showPlayButton?: CodegenTypes.WithDefault<boolean, true>;
  playButtonColor?: ColorValue;

  // ---------- v0.3: recording-mode gestures ----------
  /** When true, attaches a native pan gesture that emits `onSlideCancel`/`onSlideProgress` while recording. */
  enableSlideToCancel?: CodegenTypes.WithDefault<boolean, false>;
  /** Horizontal distance (in dp/points) to cross before `onSlideCancel` fires. */
  slideToCancelThresholdDp?: CodegenTypes.WithDefault<CodegenTypes.Float, 80.0>;
  /** When true, the same pan gesture also emits `onSlideLock`/`onSlideProgress` for vertical drags. */
  enableSlideToLock?: CodegenTypes.WithDefault<boolean, false>;
  /** Vertical distance (in dp/points) to cross before `onSlideLock` fires. */
  slideToLockThresholdDp?: CodegenTypes.WithDefault<CodegenTypes.Float, 80.0>;

  // ---------- v1.0: raw-PCM streaming (opt-in) ----------
  /**
   * When true, the engine emits chunks of raw 16-bit PCM via `onPcmChunk`
   * while recording. **Only works with `output.format = 'wav'`** because
   * the m4a / opus paths don't expose pre-encoded samples. Subscribe via
   * the `react-native-waveform-recorder/pcm-stream` subpath.
   */
  enablePcmStream?: CodegenTypes.WithDefault<boolean, false>;
  /**
   * Approximate target chunk duration in ms. The native engine flushes
   * chunks at or near this cadence. Smaller = lower latency + more JS
   * traffic; larger = bigger but cheaper chunks. Default 200ms.
   */
  pcmChunkMs?: CodegenTypes.WithDefault<CodegenTypes.Int32, 200>;

  // ---------- v1.0: background recording ----------
  /**
   * When true, the recorder keeps running while the host app is
   * backgrounded. Requires platform-specific setup:
   *
   *   - iOS: the host app must add `audio` to `UIBackgroundModes` in
   *     `Info.plist`. AVAudioSession is already configured as `.playAndRecord`.
   *   - Android: the host app must declare the
   *     `WaveformRecorderBackgroundService` in their `AndroidManifest.xml`
   *     plus the `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_MICROPHONE`
   *     permissions. The engine binds a microphone-type foreground service
   *     while recording when this prop is true.
   */
  backgroundRecording?: CodegenTypes.WithDefault<boolean, false>;
  /** Notification title shown by the Android foreground service. */
  backgroundNotificationTitle?: string;
  /** Notification body shown by the Android foreground service. */
  backgroundNotificationBody?: string;

  // ---------- v0.3: silence detection ----------
  /**
   * dBFS threshold (negative number, e.g. -50). When the rolling mean dB
   * stays below this for `silenceTimeoutMs` while recording, the engine
   * fires `onSilenceDetected`. -160 (default) effectively disables it.
   */
  silenceThresholdDb?: CodegenTypes.WithDefault<CodegenTypes.Float, -160.0>;
  /**
   * Minimum number of ms the rolling dB must stay below threshold before
   * `onSilenceDetected` fires. 0 = effectively disabled.
   */
  silenceTimeoutMs?: CodegenTypes.WithDefault<CodegenTypes.Int32, 0>;
  /** When true, the engine auto-stops recording when silence is detected. */
  autoStopOnSilence?: CodegenTypes.WithDefault<boolean, false>;

  // ---------- Controlled state ----------
  /**
   * Controlled state machine. 'auto' (default) = uncontrolled; component
   * drives its own state via commands. Otherwise the host app is responsible
   * for advancing the state via prop updates, and component commands become
   * inert (still emit `onStateChange` with the *requested* new state).
   */
  controlledState?: CodegenTypes.WithDefault<
    'auto' | 'idle' | 'recording' | 'paused' | 'preview' | 'stopped',
    'auto'
  >;

  // ---------- Events ----------
  onStateChange?: CodegenTypes.DirectEventHandler<OnStateChangeEvent>;
  onMeter?: CodegenTypes.DirectEventHandler<OnMeterEvent>;
  onComplete?: CodegenTypes.DirectEventHandler<OnCompleteEvent>;
  onMaxDurationReached?: CodegenTypes.DirectEventHandler<OnMaxDurationReachedEvent>;
  onPermissionDenied?: CodegenTypes.DirectEventHandler<OnPermissionDeniedEvent>;
  onError?: CodegenTypes.DirectEventHandler<OnErrorEvent>;
  onSeek?: CodegenTypes.DirectEventHandler<OnSeekEvent>;
  onPlaybackTimeUpdate?: CodegenTypes.DirectEventHandler<OnPlaybackTimeUpdateEvent>;
  onSlideProgress?: CodegenTypes.DirectEventHandler<OnSlideProgressEvent>;
  onSlideCancel?: CodegenTypes.DirectEventHandler<OnSlideCancelEvent>;
  onSlideLock?: CodegenTypes.DirectEventHandler<OnSlideLockEvent>;
  onSilenceDetected?: CodegenTypes.DirectEventHandler<OnSilenceDetectedEvent>;
  onPcmChunk?: CodegenTypes.DirectEventHandler<OnPcmChunkEvent>;
}

interface NativeCommands {
  start: (viewRef: React.ElementRef<HostComponent<NativeProps>>) => void;
  pause: (viewRef: React.ElementRef<HostComponent<NativeProps>>) => void;
  resume: (viewRef: React.ElementRef<HostComponent<NativeProps>>) => void;
  stop: (viewRef: React.ElementRef<HostComponent<NativeProps>>) => void;
  cancel: (viewRef: React.ElementRef<HostComponent<NativeProps>>) => void;
  // v0.2: preview commands
  enterPreview: (viewRef: React.ElementRef<HostComponent<NativeProps>>) => void;
  exitPreview: (viewRef: React.ElementRef<HostComponent<NativeProps>>) => void;
  togglePreviewPlayback: (
    viewRef: React.ElementRef<HostComponent<NativeProps>>
  ) => void;
  seekPreview: (
    viewRef: React.ElementRef<HostComponent<NativeProps>>,
    positionMs: CodegenTypes.Int32
  ) => void;
}

export const Commands: NativeCommands = codegenNativeCommands<NativeCommands>({
  supportedCommands: [
    'start',
    'pause',
    'resume',
    'stop',
    'cancel',
    'enterPreview',
    'exitPreview',
    'togglePreviewPlayback',
    'seekPreview',
  ],
});

export default codegenNativeComponent<NativeProps>('WaveformRecorderView');
