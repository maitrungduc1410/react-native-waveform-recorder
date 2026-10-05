import { forwardRef, type ForwardedRef } from 'react';
import type {
  WaveformRecorderViewProps,
  WaveformRecorderViewRef,
} from './types';

function WaveformRecorderViewInner(
  _props: WaveformRecorderViewProps,
  _ref: ForwardedRef<WaveformRecorderViewRef>
): never {
  throw new Error(
    "'react-native-waveform-recorder' is only supported on native platforms."
  );
}

/**
 * Native audio recorder with a live waveform, preview playback and
 * optional slide gestures. Drive it through a
 * {@link WaveformRecorderViewRef | ref}.
 *
 * Only iOS and Android are supported; rendering it on other platforms throws.
 *
 * @example
 * ```tsx
 * const ref = useRef<WaveformRecorderViewRef>(null);
 *
 * <WaveformRecorderView
 *   ref={ref}
 *   style={{ height: 56 }}
 *   onComplete={(e) => console.log(e.uri, e.durationMs, e.samples)}
 * />
 * ```
 */
export const WaveformRecorderView = forwardRef<
  WaveformRecorderViewRef,
  WaveformRecorderViewProps
>(WaveformRecorderViewInner);

WaveformRecorderView.displayName = 'WaveformRecorderView';

/**
 * Ask for microphone permission ahead of time, for example on an
 * onboarding screen. `start()` already calls it, so this is optional.
 *
 * On Android it requests `RECORD_AUDIO` and resolves `true` when granted.
 * On iOS it resolves `true` right away; the system prompt appears on the
 * first `start()`. On other platforms it resolves `false`.
 */
export async function ensureMicrophonePermission(): Promise<boolean> {
  return false;
}
