/**
 * Optional raw-PCM streaming helpers.
 *
 * This entry point is opt-in — importing it should not pull anything new
 * into the default `react-native-waveform-recorder` bundle. The codegen
 * spec already declares `enablePcmStream` + `onPcmChunk` on the main view;
 * the helpers below just make the base64 payload easy to consume.
 *
 * ## Usage
 *
 * ```tsx
 * import {
 *   WaveformRecorderView,
 * } from 'react-native-waveform-recorder';
 * import {
 *   decodePcmChunk,
 *   pcmToMonoFloat32,
 * } from 'react-native-waveform-recorder/pcm-stream';
 *
 * <WaveformRecorderView
 *   output={{ format: 'wav', sampleRate: 16000, channels: 1 }}
 *   enablePcmStream
 *   pcmChunkMs={100}
 *   onPcmChunk={(e) => {
 *     const int16 = decodePcmChunk(e.chunk);
 *     const float32 = pcmToMonoFloat32(int16, e.channels);
 *     // feed `float32` into Whisper / VAD / your STT pipeline of choice.
 *   }}
 * />
 * ```
 *
 * ## Caveats
 *
 *  - Streaming only works with `output.format = 'wav'`. The m4a / opus
 *    paths don't hand us pre-encoded samples.
 *  - Payloads cross the bridge as base64 strings, not zero-copy buffers.
 *    For multi-MB/s pipelines, prefer [`react-native-audio-api`] which
 *    exposes a true JSI ringbuffer.
 *
 * [`react-native-audio-api`]: https://github.com/software-mansion/react-native-audio-api
 */

/**
 * Decode the base64 `chunk` payload from an `onPcmChunk` event into an
 * `Int16Array` (one entry per interleaved sample-per-channel).
 *
 * Implemented with `global.atob` (Hermes ships it as part of the WHATWG
 * URL/Encoding shim) — no third-party dependency.
 */
export function decodePcmChunk(chunkBase64: string): Int16Array {
  const binary = decodeBase64(chunkBase64);
  // Native side guarantees little-endian 16-bit signed PCM, so we can
  // directly view the underlying buffer.
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  // Buffer offset is always 0 here; `Int16Array` requires the byte length
  // to be a multiple of 2, which the native writer guarantees.
  return new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2);
}

/**
 * Convert an interleaved Int16 PCM block into a mono Float32 array in
 * [-1, 1]. Pass the channel count from the `onPcmChunk` event.
 *
 * For 2-channel input, this averages each L/R pair into a single mono
 * sample, which is what most VAD / STT models expect.
 */
export function pcmToMonoFloat32(
  samples: Int16Array,
  channels: number
): Float32Array {
  const c = Math.max(1, channels);
  const frameCount = Math.floor(samples.length / c);
  const out = new Float32Array(frameCount);
  for (let i = 0; i < frameCount; i++) {
    let mix = 0;
    for (let ch = 0; ch < c; ch++) {
      mix += samples[i * c + ch] ?? 0;
    }
    out[i] = mix / c / 32768;
  }
  return out;
}

function decodeBase64(input: string): string {
  // Hermes + JSC both expose global.atob; fall back to a hand-rolled
  // decoder for environments that don't (rare; mostly older Hermes).
  const g = globalThis as unknown as { atob?: (s: string) => string };
  if (typeof g.atob === 'function') {
    return g.atob(input);
  }
  return polyfillAtob(input);
}

const BASE64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function polyfillAtob(input: string): string {
  let str = input.replace(/[=]+$/, '');
  let output = '';
  if (str.length % 4 === 1) {
    throw new Error('Invalid base64 input');
  }
  let bc = 0;
  let bs = 0;
  for (let i = 0; i < str.length; i++) {
    const idx = BASE64_CHARS.indexOf(str.charAt(i));
    if (idx === -1) continue;
    bs = (bs << 6) | idx;
    bc += 6;
    if (bc >= 8) {
      bc -= 8;
      output += String.fromCharCode((bs >> bc) & 0xff);
    }
  }
  return output;
}
