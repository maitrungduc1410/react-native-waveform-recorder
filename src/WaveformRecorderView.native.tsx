import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
  type ForwardedRef,
} from 'react';
import {
  PermissionsAndroid,
  Platform,
  type NativeSyntheticEvent,
} from 'react-native';
import NativeWaveformRecorderView, {
  Commands,
} from './WaveformRecorderViewNativeComponent';
import type {
  WaveformRecorderCompleteEvent,
  WaveformRecorderErrorEvent,
  WaveformRecorderMeterEvent,
  WaveformRecorderOutputFormat,
  WaveformRecorderState,
  WaveformRecorderViewProps,
  WaveformRecorderViewRef,
} from './WaveformRecorderView';

export type {
  WaveformRecorderCompleteEvent,
  WaveformRecorderErrorEvent,
  WaveformRecorderFutureBarStyle,
  WaveformRecorderMeterEvent,
  WaveformRecorderNewSampleEntry,
  WaveformRecorderOutputConfig,
  WaveformRecorderOutputFormat,
  WaveformRecorderPlaybackTimeUpdateEvent,
  WaveformRecorderRecordingMode,
  WaveformRecorderSeekEvent,
  WaveformRecorderSilenceDetectedEvent,
  WaveformRecorderSlideProgressEvent,
  WaveformRecorderState,
  WaveformRecorderStateChangeEvent,
  WaveformRecorderTimeMode,
  WaveformRecorderViewProps,
  WaveformRecorderViewRef,
} from './WaveformRecorderView';

/**
 * Request `RECORD_AUDIO` on Android. On iOS this is a no-op — the native
 * recorder engine auto-prompts via `AVAudioApplication.requestRecordPermission`
 * the first time `start()` is invoked.
 *
 * Returns `true` when permission is granted (or not needed), `false` when
 * the user denied or selected "Never ask again".
 *
 * This helper is also called automatically inside `ref.start()`. Host apps
 * can invoke it ahead of time to drive their own pre-flight UI (e.g. an
 * onboarding screen explaining why mic access is needed).
 */
export async function ensureMicrophonePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const already = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
    );
    if (already) return true;
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Microphone access',
        message:
          'This app needs microphone access to record audio with a live waveform.',
        buttonPositive: 'Allow',
        buttonNegative: 'Cancel',
      }
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

function WaveformRecorderViewInner(
  props: WaveformRecorderViewProps,
  ref: ForwardedRef<WaveformRecorderViewRef>
) {
  const nativeRef = useRef<React.ComponentRef<
    typeof NativeWaveformRecorderView
  > | null>(null);

  // Keep a ref pointing at the latest `onPermissionDenied` so the imperative
  // `start()` can fire it directly when JS-side permission request returns
  // false (Android only). Without the ref, we'd capture the *initial*
  // callback at mount time and stale-callback bugs would silently swallow
  // the event.
  const onPermissionDeniedRef = useRef(props.onPermissionDenied);
  onPermissionDeniedRef.current = props.onPermissionDenied;

  const {
    output,
    state,
    onStateChange,
    onMeter,
    onComplete,
    onMaxDurationReached,
    onPermissionDenied,
    onError,
    onSeek,
    onPlaybackTimeUpdate,
    onSlideProgress,
    onSlideCancel,
    onSlideLock,
    onSilenceDetected,
    onPcmChunk,
    ...rest
  } = props;

  // Flatten the public `output` prop into the codegen-friendly individual
  // props. Splitting on the JS side keeps the native spec simple (no nested
  // Readonly<{ ... }> objects with optional fields, which codegen handles
  // unevenly across RN versions).
  const outputUri = useMemo(() => output?.uri ?? '', [output?.uri]);
  const outputFormat = useMemo<WaveformRecorderOutputFormat>(
    () => output?.format ?? 'm4a',
    [output?.format]
  );
  const outputSampleRate = useMemo(
    () => output?.sampleRate ?? 44100,
    [output?.sampleRate]
  );
  const outputChannels = useMemo(
    () => output?.channels ?? 1,
    [output?.channels]
  );
  const outputBitrate = useMemo(
    () => output?.bitrate ?? 128000,
    [output?.bitrate]
  );
  const outputQuality = useMemo<'low' | 'medium' | 'high'>(
    () => output?.quality ?? 'high',
    [output?.quality]
  );

  // 'auto' = uncontrolled (sentinel). Anything else means the host app is
  // driving the state machine via the prop. `error` is internal-only and
  // can never be assigned from outside, so it's not a valid value here.
  type ControlledStateValue =
    | 'auto'
    | 'idle'
    | 'recording'
    | 'paused'
    | 'preview'
    | 'stopped';
  const controlledState = useMemo<ControlledStateValue>(() => {
    if (state === undefined || state === 'error') return 'auto';
    return state;
  }, [state]);

  useImperativeHandle(
    ref,
    () => ({
      start: () => {
        // Fire-and-forget: we request the permission on Android before
        // delegating to the native start command. On iOS the native engine
        // already auto-prompts via `AVAudioApplication.requestRecordPermission`,
        // so we delegate immediately.
        ensureMicrophonePermission().then((granted) => {
          if (!granted) {
            onPermissionDeniedRef.current?.();
            return;
          }
          if (nativeRef.current) Commands.start(nativeRef.current);
        });
      },
      pause: () => {
        if (nativeRef.current) Commands.pause(nativeRef.current);
      },
      resume: () => {
        if (nativeRef.current) Commands.resume(nativeRef.current);
      },
      stop: () => {
        if (nativeRef.current) Commands.stop(nativeRef.current);
      },
      cancel: () => {
        if (nativeRef.current) Commands.cancel(nativeRef.current);
      },
      enterPreview: () => {
        if (nativeRef.current) Commands.enterPreview(nativeRef.current);
      },
      exitPreview: () => {
        if (nativeRef.current) Commands.exitPreview(nativeRef.current);
      },
      togglePreviewPlayback: () => {
        if (nativeRef.current)
          Commands.togglePreviewPlayback(nativeRef.current);
      },
      seekPreview: (positionMs: number) => {
        if (nativeRef.current) {
          Commands.seekPreview(
            nativeRef.current,
            Math.max(0, Math.floor(positionMs))
          );
        }
      },
    }),
    []
  );

  return (
    <NativeWaveformRecorderView
      ref={nativeRef}
      {...rest}
      outputUri={outputUri}
      outputFormat={outputFormat}
      outputSampleRate={outputSampleRate}
      outputChannels={outputChannels}
      outputBitrate={outputBitrate}
      outputQuality={outputQuality}
      controlledState={controlledState}
      onStateChange={
        onStateChange
          ? (
              e: NativeSyntheticEvent<{
                state: string;
                durationMs: number;
              }>
            ) => {
              onStateChange({
                state: e.nativeEvent.state as WaveformRecorderState,
                durationMs: e.nativeEvent.durationMs,
              });
            }
          : undefined
      }
      onMeter={
        onMeter
          ? (e: NativeSyntheticEvent<WaveformRecorderMeterEvent>) =>
              onMeter(e.nativeEvent)
          : undefined
      }
      onComplete={
        onComplete
          ? (
              e: NativeSyntheticEvent<{
                uri: string;
                durationMs: number;
                format: string;
                mimeType: string;
                sizeBytes: number;
                sampleRate: number;
                channels: number;
                samplesCsv: string;
                peakAmplitude: number;
              }>
            ) => {
              const ne = e.nativeEvent;
              // Parse the codegen-friendly CSV payload back into a real
              // number[]. Empty string -> empty array (rare but legal: a
              // zero-duration recording).
              const samples =
                ne.samplesCsv.length === 0
                  ? []
                  : ne.samplesCsv.split(',').map((part) => {
                      const n = Number(part);
                      return Number.isFinite(n) ? n : 0;
                    });
              const event: WaveformRecorderCompleteEvent = {
                uri: ne.uri,
                durationMs: ne.durationMs,
                format: ne.format as WaveformRecorderOutputFormat,
                mimeType: ne.mimeType,
                sizeBytes: ne.sizeBytes,
                sampleRate: ne.sampleRate,
                channels: ne.channels,
                samples,
                peakAmplitude: ne.peakAmplitude,
              };
              onComplete(event);
            }
          : undefined
      }
      onMaxDurationReached={
        onMaxDurationReached ? () => onMaxDurationReached() : undefined
      }
      onPermissionDenied={
        onPermissionDenied ? () => onPermissionDenied() : undefined
      }
      onError={
        onError
          ? (e: NativeSyntheticEvent<{ message: string; code: string }>) => {
              const { message, code } = e.nativeEvent;
              const ev: WaveformRecorderErrorEvent = {
                message,
                code: code && code.length > 0 ? code : undefined,
              };
              onError(ev);
            }
          : undefined
      }
      onSeek={
        onSeek
          ? (e: NativeSyntheticEvent<{ positionMs: number }>) =>
              onSeek({ positionMs: e.nativeEvent.positionMs })
          : undefined
      }
      onPlaybackTimeUpdate={
        onPlaybackTimeUpdate
          ? (
              e: NativeSyntheticEvent<{
                positionMs: number;
                durationMs: number;
              }>
            ) => onPlaybackTimeUpdate(e.nativeEvent)
          : undefined
      }
      onSlideProgress={
        onSlideProgress
          ? (
              e: NativeSyntheticEvent<{
                cancelProgress: number;
                lockProgress: number;
              }>
            ) => onSlideProgress(e.nativeEvent)
          : undefined
      }
      onSlideCancel={onSlideCancel ? () => onSlideCancel() : undefined}
      onSlideLock={onSlideLock ? () => onSlideLock() : undefined}
      onSilenceDetected={
        onSilenceDetected
          ? (e: NativeSyntheticEvent<{ durationMs: number }>) =>
              onSilenceDetected({ durationMs: e.nativeEvent.durationMs })
          : undefined
      }
      onPcmChunk={
        onPcmChunk
          ? (
              e: NativeSyntheticEvent<{
                chunk: string;
                sampleRate: number;
                channels: number;
                bytesPerSample: number;
                timestampMs: number;
              }>
            ) => onPcmChunk(e.nativeEvent)
          : undefined
      }
    />
  );
}

export const WaveformRecorderView = forwardRef<
  WaveformRecorderViewRef,
  WaveformRecorderViewProps
>(WaveformRecorderViewInner);

WaveformRecorderView.displayName = 'WaveformRecorderView';
