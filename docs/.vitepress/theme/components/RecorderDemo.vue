<script setup lang="ts">
// Browser approximation of <WaveformRecorderView>. The drawing, timing and
// state logic follow the native views (ios/WaveformBarsView.swift,
// ios/WaveformRecorderViewImpl.swift, ios/AudioRecorderEngine.swift and the
// Android mirrors) so the props and events behave like the real component.
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useData } from 'vitepress';

type State = 'idle' | 'recording' | 'paused' | 'preview' | 'stopped' | 'error';
type Engine = 'idle' | 'recording' | 'paused' | 'between' | 'stopped';
type LogItem = { id: number; time: string; name: string; payload: string };

const strings = {
  en: {
    badge: 'Web approximation',
    intro:
      'This demo redraws the native view with Web Audio and a canvas so you can try the props, ref methods and events in a browser. The real component runs only on iOS and Android.',
    input: 'Input',
    mic: 'Microphone',
    sim: 'Simulated voice',
    denied:
      'Microphone access was denied, so onPermissionDenied fired and recording did not start. Allow the microphone for this site, or switch to the simulated voice.',
    unavailable:
      'This page cannot use a microphone here (it needs a secure context with getUserMedia). Switch to the simulated voice.',
    useSim: 'Use the simulated voice',
    hint: 'While recording, drag on the pill: left to cancel, up to lock.',
    locked: 'Locked',
    lockedNote: 'drawn by the host app after onSlideLock',
    meterModel: 'Meter mapping',
    ios: 'iOS (average power)',
    android: 'Android (peak)',
    props: 'Props',
    live: 'Live values',
    log: 'Event log',
    logEmpty: 'Call start() to begin.',
    result: 'Last onComplete',
    play: 'Play',
    pause: 'Pause',
    snippet: 'Equivalent code',
    wav: 'The demo always writes a mono WAV file in the browser.',
    silence: 'Silence detection',
    clear: 'Clear',
  },
  vi: {
    badge: 'Mô phỏng trên web',
    intro:
      'Demo này vẽ lại view native bằng Web Audio và canvas để bạn thử props, phương thức của ref và sự kiện ngay trên trình duyệt. Component thật chỉ chạy trên iOS và Android.',
    input: 'Nguồn âm thanh',
    mic: 'Micro',
    sim: 'Giọng nói mô phỏng',
    denied:
      'Quyền truy cập micro bị từ chối nên onPermissionDenied được gọi và việc ghi âm không bắt đầu. Hãy cho phép trang này dùng micro, hoặc chuyển sang giọng nói mô phỏng.',
    unavailable:
      'Trang này không dùng được micro ở đây (cần ngữ cảnh bảo mật có getUserMedia). Hãy chuyển sang giọng nói mô phỏng.',
    useSim: 'Dùng giọng nói mô phỏng',
    hint: 'Khi đang ghi âm, hãy kéo trên khung ghi âm: sang trái để hủy, lên trên để khóa.',
    locked: 'Đã khóa',
    lockedNote: 'do ứng dụng vẽ sau onSlideLock',
    meterModel: 'Cách tính mức âm',
    ios: 'iOS (công suất trung bình)',
    android: 'Android (giá trị đỉnh)',
    props: 'Props',
    live: 'Giá trị trực tiếp',
    log: 'Nhật ký sự kiện',
    logEmpty: 'Gọi start() để bắt đầu.',
    result: 'Kết quả onComplete gần nhất',
    play: 'Phát',
    pause: 'Tạm dừng',
    snippet: 'Code tương đương',
    wav: 'Demo luôn ghi ra tệp WAV một kênh ngay trên trình duyệt.',
    silence: 'Phát hiện khoảng lặng',
    clear: 'Xóa',
  },
  zh: {
    badge: '网页近似效果',
    intro:
      '本演示用 Web Audio 和 canvas 重新绘制原生视图，方便你在浏览器中试用属性、ref 方法和事件。真正的组件只能在 iOS 和 Android 上运行。',
    input: '音频输入',
    mic: '麦克风',
    sim: '模拟人声',
    denied:
      '麦克风权限被拒绝，因此触发了 onPermissionDenied，录音没有开始。请允许本站使用麦克风，或切换到模拟人声。',
    unavailable: '当前页面无法使用麦克风（需要支持 getUserMedia 的安全上下文）。请切换到模拟人声。',
    useSim: '使用模拟人声',
    hint: '录音时在录音视图上拖动：向左取消，向上锁定。',
    locked: '已锁定',
    lockedNote: '由宿主应用在 onSlideLock 后绘制',
    meterModel: '音量计算方式',
    ios: 'iOS（平均功率）',
    android: 'Android（峰值）',
    props: '属性',
    live: '实时数值',
    log: '事件日志',
    logEmpty: '调用 start() 开始。',
    result: '最近一次 onComplete',
    play: '播放',
    pause: '暂停',
    snippet: '等价代码',
    wav: '本演示总是在浏览器中生成单声道 WAV 文件。',
    silence: '静音检测',
    clear: '清空',
  },
} as const;

const { lang } = useData();
const t = computed(() =>
  lang.value.startsWith('vi')
    ? strings.vi
    : lang.value.startsWith('zh')
      ? strings.zh
      : strings.en
);

// Library defaults (src/WaveformRecorderViewNativeComponent.ts and the native
// fallbacks), except the two gesture switches, which the demo turns on.
const DEFAULTS = {
  playedBarColor: '#ffffff',
  containerBackgroundColor: '#3478f6',
  barWidth: 3,
  barGap: 2,
  samplesPerSecond: 12,
  meterUpdatesPerSecond: 30,
  futureBarStyle: 'hidden' as 'hidden' | 'dot' | 'line',
  timeMode: 'count-up' as 'count-up' | 'count-down',
  maxDurationMs: 0,
  enablePreview: true,
  enableContinueRecording: true,
  enableSlideToCancel: false,
  enableSlideToLock: false,
  slideToCancelThresholdDp: 80,
  slideToLockThresholdDp: 80,
  silenceThresholdDb: -160,
  silenceTimeoutMs: 0,
  autoStopOnSilence: false,
};
const p = reactive({
  ...DEFAULTS,
  enableSlideToCancel: true,
  enableSlideToLock: true,
});
const UNPLAYED = 'rgba(255, 255, 255, 0.5)';
const FUTURE = 'rgba(255, 255, 255, 0.6)';
const HEIGHT = 56;
const INSET = 12;
const TIME_W = 48;
const ENTRY = 4;
const EXIT = 4;

const meterModel = ref<'ios' | 'android'>('ios');
const inputMode = ref<'mic' | 'sim'>('mic');
const notice = ref<'' | 'denied' | 'unavailable'>('');
const state = ref<State>('idle');
const locked = ref(false);
const timeText = ref('0:00');
const live = reactive({ amplitude: 0, peak: 0, db: -160, cancel: 0, lock: 0, positionMs: 0 });
const log = ref<LogItem[]>([]);
const result = ref<null | {
  uri: string;
  durationMs: number;
  sizeBytes: number;
  sampleRate: number;
  samples: number[];
  peakAmplitude: number;
}>(null);
const resultPlaying = ref(false);
const silenceOn = computed({
  get: () => p.silenceTimeoutMs > 0,
  set: (on: boolean) => {
    p.silenceThresholdDb = on ? -45 : DEFAULTS.silenceThresholdDb;
    p.silenceTimeoutMs = on ? 1500 : DEFAULTS.silenceTimeoutMs;
    if (!on) p.autoStopOnSilence = false;
  },
});

// ---------------------------------------------------------------- events

let logId = 0;
function emit(name: string, payload?: object) {
  const now = new Date();
  log.value.unshift({
    id: ++logId,
    time: `${now.toLocaleTimeString([], { hour12: false })}.${String(now.getMilliseconds()).padStart(3, '0')}`,
    name,
    payload: payload ? JSON.stringify(payload) : '',
  });
  if (log.value.length > 30) log.value.length = 30;
}

let lastEmitted: State | '' = '';
function setState(s: State) {
  state.value = s;
  if (s !== lastEmitted) {
    lastEmitted = s;
    emit('onStateChange', { state: s, durationMs: Math.round(durationMs()) });
  }
  if (s !== 'preview') stopPlayer();
  kick();
}

// ---------------------------------------------------------------- audio input

let ctx: AudioContext | null = null;
let stream: MediaStream | null = null;
let proc: ScriptProcessorNode | null = null;
let srcNode: MediaStreamAudioSourceNode | null = null;
let simTimer: ReturnType<typeof setInterval> | null = null;
let simPhase = 0;
let sampleRate = 48000;

async function openInput(): Promise<boolean> {
  if (stream || simTimer) return true;
  if (inputMode.value === 'sim') {
    sampleRate = 16000;
    let last = performance.now();
    simTimer = setInterval(() => {
      const now = performance.now();
      const n = Math.round(((now - last) / 1000) * sampleRate);
      last = now;
      if (n > 0) onPcm(synthVoice(n));
    }, 20);
    return true;
  }
  if (!navigator.mediaDevices?.getUserMedia || typeof AudioContext === 'undefined') {
    notice.value = 'unavailable';
    return false;
  }
  try {
    ctx = new AudioContext();
    await ctx.resume();
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    closeInput();
    notice.value = 'denied';
    return false;
  }
  sampleRate = ctx.sampleRate;
  srcNode = ctx.createMediaStreamSource(stream);
  proc = ctx.createScriptProcessor(1024, 1, 1);
  proc.onaudioprocess = (e) => onPcm(new Float32Array(e.inputBuffer.getChannelData(0)));
  srcNode.connect(proc);
  proc.connect(ctx.destination);
  notice.value = '';
  return true;
}

function closeInput() {
  if (simTimer) clearInterval(simTimer);
  simTimer = null;
  proc?.disconnect();
  srcNode?.disconnect();
  stream?.getTracks().forEach((tr) => tr.stop());
  ctx?.close().catch(() => {});
  proc = null;
  srcNode = null;
  stream = null;
  ctx = null;
}

// Speech-like noise: syllables at ~4 Hz in phrases separated by short pauses.
function synthVoice(n: number): Float32Array {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    simPhase += 1 / sampleRate;
    const phrase = simPhase % 3.4;
    const talking = phrase < 2.4;
    const syllable = 0.5 - 0.5 * Math.cos(2 * Math.PI * 4 * simPhase);
    const env = talking ? 0.04 + 0.4 * syllable * (0.6 + 0.4 * Math.sin(simPhase * 1.7)) : 0.002;
    const voiced = Math.sin(2 * Math.PI * 160 * simPhase) * 0.6 + (Math.random() * 2 - 1) * 0.4;
    out[i] = voiced * env;
  }
  return out;
}

// ---------------------------------------------------------------- engine

let engine: Engine = 'idle';
let segments: Float32Array[][] = [];
let current: Float32Array[] | null = null;
let completedMs = 0;
let segmentMs = 0;
let segmentStart = 0;
let history: number[] = [];
let peakAmp = 0;
let meterSumSq = 0;
let meterCount = 0;
let meterPeak = 0;
let lastMeter = 0;
let lastVisual = 0;
let lastLoud = 0;
let silenceFired = false;

// Live ribbon (recording / frozen) and the static preview ribbon.
let recordingAmps: number[] = [];
let barsLive = false;
let lastAppend = 0;

function durationMs() {
  return completedMs + segmentMs + (engine === 'recording' ? performance.now() - segmentStart : 0);
}

function onPcm(chunk: Float32Array) {
  if (engine !== 'recording' || !current) return;
  current.push(chunk);
  for (let i = 0; i < chunk.length; i++) {
    const v = chunk[i]!;
    meterSumSq += v * v;
    const a = Math.abs(v);
    if (a > meterPeak) meterPeak = a;
  }
  meterCount += chunk.length;
}

function meterTick(now: number) {
  if (lastMeter > 0 && now - lastMeter < 1000 / p.meterUpdatesPerSecond - 1) return;
  lastMeter = now;
  let amp: number;
  let db: number;
  if (meterModel.value === 'ios') {
    // AVAudioRecorder.averagePower, then dbToAmplitude(): 0 at or below -60 dB.
    const rms = meterCount ? Math.sqrt(meterSumSq / meterCount) : 0;
    db = rms > 0 ? Math.max(-160, 20 * Math.log10(rms)) : -160;
    amp = db <= -60 ? 0 : db >= 0 ? 1 : Math.pow(10, db / 20);
  } else {
    // MediaRecorder.maxAmplitude / 32767, sqrt for the visual amplitude.
    const linear = Math.min(1, meterPeak);
    db = linear <= 0 ? -160 : 20 * Math.log10(linear);
    amp = Math.sqrt(linear);
  }
  meterSumSq = 0;
  meterCount = 0;
  meterPeak = 0;
  if (amp > peakAmp) peakAmp = amp;
  history.push(amp);
  live.amplitude = amp;
  live.peak = peakAmp;
  live.db = db;

  if (lastVisual === 0 || now - lastVisual >= 1000 / p.samplesPerSecond - 1) {
    lastVisual = now;
    recordingAmps.push(Math.max(0, Math.min(1, amp)));
    if (recordingAmps.length > 4096) recordingAmps.splice(0, recordingAmps.length - 4096);
    lastAppend = now;
  }
  updateTime();
  observeSilence(db, now);
  if (p.maxDurationMs > 0 && durationMs() >= p.maxDurationMs) {
    emit('onMaxDurationReached');
    stopFinalize();
  }
}

function observeSilence(db: number, now: number) {
  if (p.silenceTimeoutMs <= 0) {
    lastLoud = 0;
    silenceFired = false;
    return;
  }
  if (db >= p.silenceThresholdDb) {
    lastLoud = now;
    silenceFired = false;
    return;
  }
  if (lastLoud === 0) {
    lastLoud = now;
    return;
  }
  const elapsed = Math.round(now - lastLoud);
  if (elapsed >= p.silenceTimeoutMs && !silenceFired) {
    silenceFired = true;
    emit('onSilenceDetected', { durationMs: elapsed });
    if (p.autoStopOnSilence) stopFinalize();
  }
}

function beginSegment(fresh: boolean) {
  if (fresh) {
    segments = [];
    completedMs = 0;
    history = [];
    peakAmp = 0;
    recordingAmps = [];
    revoke(previewUrl);
    previewUrl = '';
  }
  if (!barsLive) {
    // WaveformBarsView clears its ring when isRecording flips to true.
    recordingAmps = fresh ? [] : history.slice(-4096);
  }
  barsLive = true;
  current = [];
  segmentMs = 0;
  segmentStart = performance.now();
  lastMeter = 0;
  lastVisual = 0;
  lastLoud = 0;
  silenceFired = false;
  engine = 'recording';
  setState('recording');
}

function pauseEngine() {
  if (engine !== 'recording') return;
  segmentMs += performance.now() - segmentStart;
  engine = 'paused';
}

function finalizeSegment() {
  if (engine === 'recording') pauseEngine();
  if (engine !== 'paused' || !current) return;
  completedMs += segmentMs;
  segmentMs = 0;
  if (current.length) segments.push(current);
  current = null;
  engine = 'between';
}

function stopFinalize() {
  if (engine === 'recording' || engine === 'paused') finalizeSegment();
  closeInput();
  engine = 'stopped';
  barsLive = false;
  if (!segments.length) {
    setState('stopped');
    return;
  }
  const wav = encodeWav(segments.flat(), sampleRate);
  const total = Math.round(completedMs);
  revoke(result.value?.uri);
  result.value = {
    uri: URL.createObjectURL(wav),
    durationMs: total,
    sizeBytes: wav.size,
    sampleRate,
    samples: downsampleTo64(history),
    peakAmplitude: peakAmp,
  };
  emit('onComplete', {
    uri: 'blob:…',
    durationMs: total,
    format: 'wav',
    mimeType: 'audio/wav',
    sizeBytes: wav.size,
    sampleRate,
    channels: 1,
    samples: `[${result.value.samples
      .slice(0, 3)
      .map((v) => v.toFixed(2))
      .join(', ')}, … 64 values]`,
    peakAmplitude: Number(peakAmp.toFixed(3)),
  });
  locked.value = false;
  setState('stopped');
}

// ---------------------------------------------------------------- ref methods

let starting = false;
async function start() {
  if (engine === 'recording' || starting) return;
  if (engine === 'paused') return resume();
  starting = true;
  const ok = await openInput();
  starting = false;
  if (!ok) {
    emit('onPermissionDenied');
    return;
  }
  if (state.value === 'preview') exitPreviewInternal();
  locked.value = false;
  beginSegment(engine !== 'between');
}

function pause() {
  if (state.value !== 'recording') return;
  pauseEngine();
  setState('paused');
}

async function resume() {
  if (state.value === 'paused') {
    if (engine === 'paused') {
      segmentStart = performance.now();
      engine = 'recording';
      lastMeter = 0;
      setState('recording');
    } else if (engine === 'between') {
      if (await openInput()) beginSegment(false);
    }
  } else if (state.value === 'preview') {
    if (!p.enableContinueRecording) {
      emit('onError', {
        message: 'enableContinueRecording is false; resume() from preview is disabled',
        code: 'continue-disabled',
      });
      return;
    }
    exitPreviewInternal();
    if (await openInput()) beginSegment(false);
  }
}

function stop() {
  if (state.value === 'preview') stopPlayer();
  stopFinalize();
}

function cancel() {
  if (state.value === 'preview') exitPreviewInternal();
  closeInput();
  engine = 'idle';
  segments = [];
  current = null;
  completedMs = 0;
  segmentMs = 0;
  history = [];
  peakAmp = 0;
  recordingAmps = [];
  barsLive = false;
  locked.value = false;
  live.amplitude = 0;
  live.peak = 0;
  live.db = -160;
  setState('idle');
  updateTime();
}

let previewUrl = '';
let previewAmps: number[] = [];
let progress = 0;
let player: HTMLAudioElement | null = null;
const playing = ref(false);

function enterPreview() {
  if (!p.enablePreview) {
    emit('onError', { message: 'enablePreview is false; enterPreview() is disabled', code: 'preview-disabled' });
    return;
  }
  finalizeSegment();
  if (!segments.length) {
    emit('onError', { message: 'No segments to preview', code: 'preview-snapshot' });
    return;
  }
  revoke(previewUrl);
  previewUrl = URL.createObjectURL(encodeWav(segments.flat(), sampleRate));
  previewAmps = history.slice();
  barsLive = false;
  progress = 0;
  setState('preview');
  player = new Audio(previewUrl);
  player.addEventListener('ended', () => {
    playing.value = false;
    kick();
  });
  updateTime(0);
}

function exitPreview() {
  exitPreviewInternal();
  setState('paused');
}

function exitPreviewInternal() {
  stopPlayer();
  progress = 0;
  revoke(previewUrl);
  previewUrl = '';
  barsLive = true;
  recordingAmps = history.slice(-4096);
}

function togglePreviewPlayback() {
  if (state.value !== 'preview' || !player) return;
  if (player.paused) {
    player.play().catch(() => {});
    playing.value = true;
  } else {
    player.pause();
    playing.value = false;
  }
  kick();
}

function stopPlayer() {
  if (player) {
    player.pause();
    player = null;
  }
  playing.value = false;
}

const methods: [string, () => unknown, (s: State) => boolean][] = [
  ['start()', start, (s) => s !== 'recording'],
  ['pause()', pause, (s) => s === 'recording'],
  ['resume()', resume, (s) => s === 'paused' || s === 'preview'],
  ['stop()', stop, (s) => s === 'recording' || s === 'paused' || s === 'preview'],
  ['cancel()', cancel, (s) => s !== 'idle'],
  ['enterPreview()', enterPreview, (s) => s === 'recording' || s === 'paused'],
  ['exitPreview()', exitPreview, (s) => s === 'preview'],
  ['togglePreviewPlayback()', togglePreviewPlayback, (s) => s === 'preview'],
];

// ---------------------------------------------------------------- time label

function updateTime(currentMs?: number) {
  let cur: number;
  let dur: number;
  if (state.value === 'preview') {
    const d = player && Number.isFinite(player.duration) ? player.duration * 1000 : completedMs;
    cur = currentMs ?? (player ? player.currentTime * 1000 : 0);
    dur = Math.max(d, completedMs);
  } else {
    cur = durationMs();
    dur = p.maxDurationMs;
  }
  const shown = p.timeMode === 'count-down' && dur > 0 ? Math.max(0, dur - cur) : cur;
  const s = Math.floor(shown / 1000);
  timeText.value = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ---------------------------------------------------------------- drawing

const wrap = ref<HTMLDivElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
let width = 0;
let raf = 0;

const showPlay = computed(() => state.value === 'preview');
function barsRect() {
  const playSize = Math.min(HEIGHT * 0.6, 36);
  const left = INSET + (showPlay.value ? playSize + 8 : 0);
  const right = width - INSET - (TIME_W + 8);
  return { x: left, w: Math.max(0, right - left) };
}

const easeOutCubic = (x: number) => 1 - (1 - x) ** 3;

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
  c.fill();
}

function draw(now: number) {
  const cv = canvas.value;
  if (!cv || width <= 0) return;
  const dpr = window.devicePixelRatio || 1;
  if (cv.width !== Math.round(width * dpr)) {
    cv.width = Math.round(width * dpr);
    cv.height = Math.round(HEIGHT * dpr);
  }
  const c = cv.getContext('2d')!;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, width, HEIGHT);
  const { x: ox, w: W } = barsRect();
  const H = HEIGHT;
  const bw = p.barWidth;
  const step = bw + p.barGap;
  const vpad = bw * 1.5;
  const radius = bw / 2;
  c.save();
  c.translate(ox, 0);

  if (state.value === 'preview') {
    if (!previewAmps.length) return c.restore();
    const count = Math.max(1, Math.floor(W / step));
    const dh = H - vpad * 2;
    const bars: [number, number, number][] = [];
    for (let i = 0; i < count; i++) {
      const amp = previewAmps[Math.min(previewAmps.length - 1, Math.floor((i * previewAmps.length) / count))]!;
      const bh = Math.max(bw, amp * dh);
      bars.push([i * step, vpad + (dh - bh) / 2, bh]);
    }
    c.fillStyle = UNPLAYED;
    for (const [x, y, h] of bars) roundRect(c, x, y, bw, h, radius);
    const px = Math.max(0, Math.min(1, progress)) * W;
    if (px > 0) {
      c.beginPath();
      c.rect(0, 0, px, H);
      c.clip();
      c.fillStyle = p.playedBarColor;
      for (const [x, y, h] of bars) roundRect(c, x, y, bw, h, radius);
    }
    return c.restore();
  }

  const visible = Math.max(1, Math.floor(W / step));
  const dh = Math.max(bw, H - vpad * 2);
  const interval = 1000 / Math.max(1, p.samplesPerSecond);
  const raw = barsLive ? (lastAppend === 0 ? 1 : Math.min(1, (now - lastAppend) / interval)) : 1;
  const n = recordingAmps.length;
  const renderCount = Math.min(n, visible + EXIT);
  c.fillStyle = p.playedBarColor;
  for (let i = 0; i < renderCount; i++) {
    const src = n - renderCount + i;
    const age = n - 1 - src;
    const slot = age === 0 ? 0 : age - 1 + raw;
    const entry = barsLive ? easeOutCubic(Math.min(1, (age + raw) / ENTRY)) : 1;
    const exit = Math.min(1, Math.max(0, (visible - slot) / EXIT));
    const scale = entry * exit;
    if (scale <= 0) continue;
    const bh = Math.max(bw, recordingAmps[src]! * dh) * scale;
    roundRect(c, W - bw - slot * step, vpad + (dh - bh) / 2, bw, bh, radius);
  }
  if (p.futureBarStyle !== 'hidden') {
    const future = visible - Math.min(n, visible);
    c.fillStyle = FUTURE;
    const cy = vpad + dh / 2;
    for (let i = 0; i < future; i++) {
      if (p.futureBarStyle === 'dot') {
        c.beginPath();
        c.arc(i * step + bw / 2, cy, bw / 2, 0, Math.PI * 2);
        c.fill();
      } else {
        roundRect(c, i * step, cy - bw * 2, bw, bw * 4, bw / 2);
      }
    }
  }
  c.restore();
}

function frame(now: number) {
  raf = 0;
  if (engine === 'recording' && state.value === 'recording') meterTick(now);
  if (state.value === 'preview' && player && playing.value && !scrubbing) {
    const d = player.duration * 1000;
    if (d > 0) {
      progress = (player.currentTime * 1000) / d;
      live.positionMs = Math.round(player.currentTime * 1000);
      updateTime();
    }
  }
  draw(now);
  const settling = barsLive && now - lastAppend < 1000;
  if (state.value === 'recording' || settling || playing.value) kick();
}

function kick() {
  if (!raf && typeof window !== 'undefined') raf = requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- pointer: slide gestures and scrub

let gesture: null | { x: number; y: number; firedC: boolean; firedL: boolean; done: boolean } = null;
let scrubbing = false;
let resumeAfterScrub = false;

function fractionAt(e: PointerEvent) {
  const box = canvas.value!.getBoundingClientRect();
  const { x, w } = barsRect();
  return Math.max(0, Math.min(1, (e.clientX - box.left - x) / (w || 1)));
}

function onDown(e: PointerEvent) {
  if (state.value === 'recording' && (p.enableSlideToCancel || p.enableSlideToLock)) {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    gesture = { x: e.clientX, y: e.clientY, firedC: false, firedL: false, done: false };
    slide(0, 0);
  } else if (state.value === 'preview' && player) {
    const { x, w } = barsRect();
    const lx = e.clientX - canvas.value!.getBoundingClientRect().left;
    if (lx < x || lx > x + w) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    scrubbing = true;
    resumeAfterScrub = playing.value;
    if (playing.value) {
      player.pause();
      playing.value = false;
    }
    scrubTo(fractionAt(e));
  }
}

function onMove(e: PointerEvent) {
  if (gesture && !gesture.done) {
    const dx = e.clientX - gesture.x;
    const dy = e.clientY - gesture.y;
    const cp = p.enableSlideToCancel ? Math.max(0, Math.min(1, -dx / p.slideToCancelThresholdDp)) : 0;
    const lp = p.enableSlideToLock ? Math.max(0, Math.min(1, -dy / p.slideToLockThresholdDp)) : 0;
    slide(cp, lp);
    if (p.enableSlideToCancel && cp >= 1 && cp >= lp) {
      gesture.done = gesture.firedC = true;
      emit('onSlideCancel');
      // Host code: onSlideCancel={() => ref.current?.cancel()}
      cancel();
    } else if (p.enableSlideToLock && lp >= 1) {
      gesture.done = gesture.firedL = true;
      emit('onSlideLock');
      locked.value = true;
    }
  } else if (scrubbing) {
    scrubTo(fractionAt(e));
  }
}

function onUp(e: PointerEvent) {
  if (gesture) {
    if (!gesture.firedC && !gesture.firedL) slide(0, 0);
    gesture = null;
  } else if (scrubbing && player) {
    scrubbing = false;
    const f = fractionAt(e);
    scrubTo(f);
    emit('onSeek', { positionMs: Math.round(f * (player.duration * 1000 || 0)) });
    if (resumeAfterScrub) {
      player.play().catch(() => {});
      playing.value = true;
      kick();
    }
  }
}

function slide(cancelProgress: number, lockProgress: number) {
  live.cancel = cancelProgress;
  live.lock = lockProgress;
}

function scrubTo(f: number) {
  if (!player) return;
  const d = player.duration * 1000 || 0;
  player.currentTime = (f * d) / 1000;
  progress = f;
  live.positionMs = Math.round(f * d);
  updateTime(f * d);
  draw(performance.now());
}

// ---------------------------------------------------------------- export helpers

function encodeWav(chunks: Float32Array[], rate: number): Blob {
  const length = chunks.reduce((n, ch) => n + ch.length, 0);
  const buf = new ArrayBuffer(44 + length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + length * 2, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, 'data');
  v.setUint32(40, length * 2, true);
  let o = 44;
  for (const ch of chunks) {
    for (let i = 0; i < ch.length; i++, o += 2) {
      const s = Math.max(-1, Math.min(1, ch[i]!));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
  }
  return new Blob([buf], { type: 'audio/wav' });
}

// Same as downsampleTo64() in the native views: RMS per bucket, normalised to the loudest.
function downsampleTo64(samples: number[]): number[] {
  const out = new Array<number>(64).fill(0);
  if (!samples.length) return out;
  const sum = new Array<number>(64).fill(0);
  const count = new Array<number>(64).fill(0);
  samples.forEach((s, i) => {
    const b = Math.min(63, Math.floor((i * 64) / samples.length));
    sum[b]! += s * s;
    count[b]!++;
  });
  let max = 0;
  for (let i = 0; i < 64; i++) {
    if (count[i]) out[i] = Math.sqrt(sum[i]! / count[i]!);
    if (out[i]! > max) max = out[i]!;
  }
  return max > 0 ? out.map((x) => Math.min(1, x / max)) : out;
}

function revoke(url?: string) {
  if (url) URL.revokeObjectURL(url);
}

let resultAudio: HTMLAudioElement | null = null;
function toggleResult() {
  if (!result.value) return;
  if (!resultAudio || resultAudio.src !== result.value.uri) {
    resultAudio?.pause();
    resultAudio = new Audio(result.value.uri);
    resultAudio.addEventListener('ended', () => (resultPlaying.value = false));
  }
  if (resultAudio.paused) {
    resultAudio.play().catch(() => {});
    resultPlaying.value = true;
  } else {
    resultAudio.pause();
    resultPlaying.value = false;
  }
}

// ---------------------------------------------------------------- snippet

const snippet = computed(() => {
  const lines = ['<WaveformRecorderView', '  ref={ref}', `  style={{ height: ${HEIGHT} }}`];
  const d = DEFAULTS as Record<string, unknown>;
  for (const [k, v] of Object.entries(p)) {
    if (d[k] === v) continue;
    if (typeof v === 'boolean') lines.push(v ? `  ${k}` : `  ${k}={false}`);
    else if (typeof v === 'number') lines.push(`  ${k}={${v}}`);
    else lines.push(`  ${k}="${v}"`);
  }
  if (p.enableSlideToCancel) lines.push('  onSlideCancel={() => ref.current?.cancel()}');
  if (p.enableSlideToLock) lines.push('  onSlideLock={() => setLocked(true)}');
  lines.push('  onComplete={(e) => send(e.uri, e.samples)}', '/>');
  return lines.join('\n');
});

// ---------------------------------------------------------------- lifecycle

let ro: ResizeObserver | null = null;
onMounted(() => {
  ro = new ResizeObserver(([entry]) => {
    width = entry!.contentRect.width;
    draw(performance.now());
  });
  if (wrap.value) ro.observe(wrap.value);
});

onBeforeUnmount(() => {
  ro?.disconnect();
  if (raf) cancelAnimationFrame(raf);
  closeInput();
  stopPlayer();
  resultAudio?.pause();
  revoke(previewUrl);
  revoke(result.value?.uri);
});

watch(
  () => [p.barWidth, p.barGap, p.playedBarColor, p.futureBarStyle, p.timeMode, p.maxDurationMs],
  () => {
    updateTime();
    draw(performance.now());
  }
);
watch(inputMode, () => {
  notice.value = '';
  if (engine === 'idle' || engine === 'stopped') closeInput();
});

function useSim() {
  inputMode.value = 'sim';
  notice.value = '';
}

const fmt = (n: number, d = 2) => n.toFixed(d);
</script>

<template>
  <div class="rnwr-demo">
    <div class="head">
      <span class="badge">{{ t.badge }}</span>
      <p>{{ t.intro }}</p>
    </div>

    <div class="stage">
      <div class="input-row">
        <span>{{ t.input }}:</span>
        <label><input v-model="inputMode" type="radio" value="mic" :disabled="state === 'recording'" /> {{ t.mic }}</label>
        <label><input v-model="inputMode" type="radio" value="sim" :disabled="state === 'recording'" /> {{ t.sim }}</label>
        <span class="state">state: <code>{{ state }}</code></span>
      </div>

      <div v-if="notice" class="notice" role="alert">
        {{ notice === 'denied' ? t.denied : t.unavailable }}
        <button type="button" @click="useSim">{{ t.useSim }}</button>
      </div>

      <div class="pill-row">
        <div v-if="locked" class="locked">
          <span>{{ t.locked }}</span> <small>({{ t.lockedNote }})</small>
        </div>
        <div
          ref="wrap"
          class="pill"
          :class="{ dragging: state === 'recording' && (p.enableSlideToCancel || p.enableSlideToLock) }"
          :style="{ background: p.containerBackgroundColor }"
          @pointerdown="onDown"
          @pointermove="onMove"
          @pointerup="onUp"
          @pointercancel="onUp"
        >
          <canvas ref="canvas" :style="{ height: `${HEIGHT}px` }" aria-hidden="true" />
          <button
            v-if="showPlay"
            type="button"
            class="play"
            :aria-label="playing ? t.pause : t.play"
            @pointerdown.stop
            @click="togglePreviewPlayback"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path v-if="playing" d="M7 5h3.5v14H7zm6.5 0H17v14h-3.5z" />
              <path v-else d="M8 5.5v13l10.5-6.5z" />
            </svg>
          </button>
          <span class="time" aria-live="off">{{ timeText }}</span>
        </div>
        <p class="hint">{{ t.hint }}</p>
      </div>

      <div class="methods">
        <button
          v-for="[label, fn, enabled] in methods"
          :key="label"
          type="button"
          :class="{ dim: !enabled(state) }"
          @click="fn()"
        >
          {{ label }}
        </button>
      </div>
    </div>

    <div class="panels">
      <section>
        <h4>{{ t.props }}</h4>
        <div class="grid">
          <label>playedBarColor <input v-model="p.playedBarColor" type="color" /></label>
          <label>containerBackgroundColor <input v-model="p.containerBackgroundColor" type="color" /></label>
          <label>barWidth <span>{{ p.barWidth }}</span><input v-model.number="p.barWidth" type="range" min="1" max="8" /></label>
          <label>barGap <span>{{ p.barGap }}</span><input v-model.number="p.barGap" type="range" min="0" max="8" /></label>
          <label>samplesPerSecond <span>{{ p.samplesPerSecond }}</span><input v-model.number="p.samplesPerSecond" type="range" min="4" max="30" /></label>
          <label>
            futureBarStyle
            <select v-model="p.futureBarStyle">
              <option value="hidden">hidden</option>
              <option value="dot">dot</option>
              <option value="line">line</option>
            </select>
          </label>
          <label>
            timeMode
            <select v-model="p.timeMode">
              <option value="count-up">count-up</option>
              <option value="count-down">count-down</option>
            </select>
          </label>
          <label>
            maxDurationMs
            <select v-model.number="p.maxDurationMs">
              <option :value="0">0</option>
              <option :value="10000">10000</option>
              <option :value="30000">30000</option>
            </select>
          </label>
          <label class="check"><input v-model="p.enableSlideToCancel" type="checkbox" /> enableSlideToCancel</label>
          <label class="check"><input v-model="p.enableSlideToLock" type="checkbox" /> enableSlideToLock</label>
          <label class="check"><input v-model="p.enablePreview" type="checkbox" /> enablePreview</label>
          <label class="check"><input v-model="p.enableContinueRecording" type="checkbox" /> enableContinueRecording</label>
          <label class="check"><input v-model="silenceOn" type="checkbox" /> {{ t.silence }}</label>
          <template v-if="silenceOn">
            <label>silenceThresholdDb <span>{{ p.silenceThresholdDb }}</span><input v-model.number="p.silenceThresholdDb" type="range" min="-80" max="-10" /></label>
            <label>silenceTimeoutMs <span>{{ p.silenceTimeoutMs }}</span><input v-model.number="p.silenceTimeoutMs" type="range" min="500" max="5000" step="250" /></label>
            <label class="check"><input v-model="p.autoStopOnSilence" type="checkbox" /> autoStopOnSilence</label>
          </template>
          <label>
            {{ t.meterModel }}
            <select v-model="meterModel">
              <option value="ios">{{ t.ios }}</option>
              <option value="android">{{ t.android }}</option>
            </select>
          </label>
        </div>
      </section>

      <section>
        <h4>{{ t.live }}</h4>
        <ul class="live">
          <li><code>onMeter</code> amplitude {{ fmt(live.amplitude) }}, peak {{ fmt(live.peak) }}, db {{ fmt(live.db, 1) }}</li>
          <li>
            <code>onSlideProgress</code>
            <span class="bar"><span class="fill cancel" :style="{ width: `${live.cancel * 100}%` }" /></span> cancelProgress {{ fmt(live.cancel) }}
            <span class="bar"><span class="fill lock" :style="{ width: `${live.lock * 100}%` }" /></span> lockProgress {{ fmt(live.lock) }}
          </li>
          <li><code>onPlaybackTimeUpdate</code> positionMs {{ live.positionMs }}</li>
        </ul>

        <h4>
          {{ t.log }}
          <button v-if="log.length" type="button" class="link" @click="log = []">{{ t.clear }}</button>
        </h4>
        <ol class="log" aria-live="polite">
          <li v-if="!log.length" class="empty">{{ t.logEmpty }}</li>
          <li v-for="item in log" :key="item.id">
            <span class="ts">{{ item.time }}</span> <code>{{ item.name }}</code> <span class="payload">{{ item.payload }}</span>
          </li>
        </ol>

        <template v-if="result">
          <h4>{{ t.result }}</h4>
          <div class="note">
            <button type="button" class="note-play" :aria-label="resultPlaying ? t.pause : t.play" @click="toggleResult">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path v-if="resultPlaying" d="M7 5h3.5v14H7zm6.5 0H17v14h-3.5z" />
                <path v-else d="M8 5.5v13l10.5-6.5z" />
              </svg>
            </button>
            <span class="note-bars" aria-hidden="true">
              <span v-for="(s, i) in result.samples" :key="i" :style="{ height: `${Math.max(8, s * 100)}%` }" />
            </span>
            <span class="note-meta">{{ (result.durationMs / 1000).toFixed(1) }} s · {{ Math.round(result.sizeBytes / 1024) }} KB · {{ result.sampleRate }} Hz</span>
          </div>
          <p class="small">{{ t.wav }}</p>
        </template>
      </section>
    </div>

    <details class="snippet">
      <summary>{{ t.snippet }}</summary>
      <pre><code>{{ snippet }}</code></pre>
    </details>
  </div>
</template>

<style scoped>
.rnwr-demo {
  margin: 24px 0;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
  overflow: hidden;
}

.head {
  padding: 16px 20px 0;
}

.head p {
  margin: 8px 0 0;
  font-size: 14px;
  color: var(--vp-c-text-2);
}

.badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-size: 12px;
  font-weight: 600;
}

.stage {
  padding: 16px 20px;
}

.input-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  align-items: center;
  font-size: 14px;
}

.input-row .state {
  margin-left: auto;
  color: var(--vp-c-text-2);
}

.notice {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--vp-c-warning-2);
  background: var(--vp-c-warning-soft);
  font-size: 14px;
}

.notice button {
  margin-left: 8px;
  text-decoration: underline;
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

.pill-row {
  position: relative;
  margin-top: 16px;
}

.locked {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-brand-1);
}

.locked small {
  font-weight: 400;
  color: var(--vp-c-text-2);
}

.pill {
  position: relative;
  border-radius: 16px;
  user-select: none;
}

.pill.dragging {
  touch-action: none;
  cursor: grab;
}

.pill canvas {
  display: block;
  width: 100%;
}

.play {
  position: absolute;
  top: 50%;
  left: 12px;
  width: 33.6px;
  height: 33.6px;
  transform: translateY(-50%);
  padding: 4px;
}

.play svg {
  width: 100%;
  height: 100%;
  fill: #ffffff;
}

.time {
  position: absolute;
  top: 0;
  right: 12px;
  width: 48px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  color: #ffffff;
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}

.hint {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.methods {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.methods button {
  padding: 4px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  color: var(--vp-c-text-1);
}

.methods button:hover {
  border-color: var(--vp-c-brand-1);
}

.methods button.dim {
  color: var(--vp-c-text-3);
}

.panels {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0;
  border-top: 1px solid var(--vp-c-divider);
}

@media (min-width: 768px) {
  .panels {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .panels section + section {
    border-left: 1px solid var(--vp-c-divider);
  }
}

.panels section {
  padding: 12px 20px 16px;
  min-width: 0;
}

.panels h4 {
  margin: 8px 0;
  font-size: 14px;
}

.grid {
  display: grid;
  gap: 8px;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
}

.grid label {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.grid label span {
  min-width: 2.5em;
  color: var(--vp-c-text-2);
}

.grid input[type='range'] {
  flex: 1;
  min-width: 120px;
  accent-color: var(--vp-c-brand-3);
}

.grid input[type='checkbox'],
.input-row input {
  accent-color: var(--vp-c-brand-3);
}

.grid select {
  padding: 2px 6px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
}

.live {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 12px;
  font-family: var(--vp-font-family-mono);
}

.live li {
  margin: 4px 0;
}

.bar {
  display: inline-block;
  width: 60px;
  height: 6px;
  margin: 0 4px 0 8px;
  border-radius: 3px;
  background: var(--vp-c-default-soft);
  vertical-align: middle;
  overflow: hidden;
}

.fill {
  display: block;
  height: 100%;
}

.fill.cancel {
  background: #dc2626;
}

.fill.lock {
  background: var(--vp-c-text-2);
}

.log {
  max-height: 220px;
  margin: 0;
  padding: 0;
  overflow: auto;
  list-style: none;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
}

.log li {
  padding: 2px 0;
  border-bottom: 1px dashed var(--vp-c-divider);
  word-break: break-word;
}

.log .ts,
.log .empty {
  color: var(--vp-c-text-3);
}

.log .payload {
  color: var(--vp-c-text-2);
}

.link {
  margin-left: 8px;
  font-size: 12px;
  font-weight: 400;
  color: var(--vp-c-brand-1);
}

.note {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 18px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
}

.note-play {
  flex: none;
  width: 32px;
  height: 32px;
  padding: 6px;
  border-radius: 50%;
  background: #dc2626;
}

.note-play svg {
  width: 100%;
  height: 100%;
  fill: #ffffff;
}

.note-bars {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 1px;
  height: 28px;
  min-width: 0;
}

.note-bars span {
  flex: 1;
  min-width: 1px;
  border-radius: 1px;
  background: var(--vp-c-text-2);
}

.note-meta {
  flex: none;
  font-size: 12px;
  color: var(--vp-c-text-2);
}

.small {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--vp-c-text-3);
}

.snippet {
  border-top: 1px solid var(--vp-c-divider);
  padding: 12px 20px;
}

.snippet summary {
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
}

.snippet pre {
  margin: 12px 0 0;
  padding: 12px 16px;
  border-radius: 8px;
  background: var(--vp-code-block-bg);
  overflow-x: auto;
  font-size: 13px;
}
</style>
