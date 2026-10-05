<script setup lang="ts">
// Bar heights (0..1) for the live ribbon and the sent voice note. Fixed values
// keep server and client renders identical.
const live = [
  0.18, 0.3, 0.55, 0.8, 0.62, 0.4, 0.7, 0.95, 0.68, 0.45, 0.3, 0.52, 0.86, 1,
  0.74, 0.5, 0.36, 0.6, 0.82, 0.58, 0.34, 0.22, 0.4, 0.66, 0.9, 0.7, 0.46,
  0.28,
];
const note = [
  0.2, 0.35, 0.6, 0.85, 0.55, 0.4, 0.75, 1, 0.7, 0.45, 0.3, 0.5, 0.9, 0.95,
  0.65, 0.4, 0.3, 0.55, 0.8, 0.5, 0.3, 0.2, 0.35, 0.6, 0.85, 0.6, 0.4, 0.25,
  0.15, 0.3, 0.5, 0.35,
];
const liveX = (i: number) => 132 + i * 7;
const noteX = (i: number) => 150 + i * 6;
</script>

<template>
  <svg
    class="hero-art"
    viewBox="0 0 400 300"
    role="img"
    aria-label="A voice recorder: a red record dot and live waveform bars in a pill, with slide-to-cancel and slide-to-lock hints, above a sent voice note"
  >
    <defs>
      <linearGradient id="rnwr-hero-brand" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0.15" stop-color="#ef4444" />
        <stop offset="1" stop-color="#ff7a59" />
      </linearGradient>
    </defs>

    <!-- slide-to-lock hint -->
    <g class="lock">
      <rect x="338" y="18" width="40" height="64" rx="20" />
      <path class="lock-body" d="M350 52h16v12a3 3 0 0 1-3 3h-10a3 3 0 0 1-3-3z" />
      <path class="lock-shackle" d="M353 52v-5a5 5 0 0 1 10 0v5" />
      <path class="chevron" d="m352 34 6-6 6 6" />
    </g>

    <!-- recording pill -->
    <rect class="pill" x="20" y="104" width="360" height="64" rx="32" />
    <circle class="rec-ring" cx="56" cy="136" r="15" />
    <circle class="rec-dot" cx="56" cy="136" r="9" />
    <g class="cancel-hint">
      <path d="m100 128-8 8 8 8" />
      <path d="m112 128-8 8 8 8" />
    </g>
    <rect
      v-for="(h, i) in live"
      :key="`l${i}`"
      class="live-bar"
      :x="liveX(i)"
      :y="136 - h * 20"
      width="4"
      :height="Math.max(4, h * 40)"
      rx="2"
      :style="{ animationDelay: `${(i % 7) * -0.18}s` }"
    />
    <text class="time" x="358" y="141">0:07</text>

    <!-- sent voice note -->
    <rect class="bubble" x="96" y="204" width="284" height="56" rx="20" />
    <circle class="play-bg" cx="126" cy="232" r="14" />
    <path class="play" d="M122 225v14l11-7z" />
    <rect
      v-for="(h, i) in note"
      :key="`n${i}`"
      :class="i < 13 ? 'note-bar played' : 'note-bar'"
      :x="noteX(i)"
      :y="232 - Math.max(2, h * 16)"
      width="3"
      :height="Math.max(4, h * 32)"
      rx="1.5"
    />
    <text class="note-time" x="364" y="236">0:12</text>
  </svg>
</template>

<style scoped>
.hero-art {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 300px;
  transform: translate(-50%, -50%);
}

@media (min-width: 640px) {
  .hero-art {
    width: 360px;
  }
}

@media (min-width: 960px) {
  .hero-art {
    width: 400px;
  }
}

.pill {
  fill: #1f1f24;
  stroke: rgba(239, 68, 68, 0.45);
  stroke-width: 1.5;
}

:root:not(.dark) .pill {
  fill: #26262c;
}

.rec-dot {
  fill: url(#rnwr-hero-brand);
}

.rec-ring {
  fill: none;
  stroke: #ef4444;
  stroke-width: 2;
  transform-box: fill-box;
  transform-origin: center;
  animation: rec-pulse 1.6s ease-out infinite;
}

.cancel-hint path {
  fill: none;
  stroke: #a1a1aa;
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.cancel-hint path:first-child {
  opacity: 0.5;
}

.live-bar {
  fill: #ffffff;
  transform-box: fill-box;
  transform-origin: center;
  animation: bar-live 1.3s ease-in-out infinite alternate;
}

.time {
  fill: #ffffff;
  font: 600 14px var(--vp-font-family-base);
  text-anchor: end;
}

.lock rect {
  fill: var(--vp-c-bg-soft);
  stroke: var(--vp-c-divider);
}

.lock-body {
  fill: var(--vp-c-text-2);
}

.lock-shackle,
.chevron {
  fill: none;
  stroke: var(--vp-c-text-2);
  stroke-width: 2.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.chevron {
  animation: nudge-up 1.6s ease-in-out infinite;
}

.bubble {
  fill: var(--vp-c-bg-soft);
  stroke: var(--vp-c-divider);
}

.play-bg {
  fill: #dc2626;
}

.play {
  fill: #ffffff;
}

.note-bar {
  fill: var(--vp-c-text-3);
}

.note-bar.played {
  fill: #ef4444;
}

.note-time {
  fill: var(--vp-c-text-2);
  font: 500 12px var(--vp-font-family-base);
  text-anchor: end;
}

@keyframes bar-live {
  from {
    transform: scaleY(0.35);
  }
  to {
    transform: scaleY(1);
  }
}

@keyframes rec-pulse {
  0% {
    transform: scale(0.7);
    opacity: 0.9;
  }
  100% {
    transform: scale(1.35);
    opacity: 0;
  }
}

@keyframes nudge-up {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .live-bar,
  .rec-ring,
  .chevron {
    animation: none;
  }
}
</style>
