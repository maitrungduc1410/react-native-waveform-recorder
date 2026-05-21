import { useColorScheme } from 'react-native';

/**
 * Light / dark palette shared by every "generic" screen in the example app
 * (Home, Primitives, and every advanced-feature screen). Recipe screens that mimic a specific
 * social-media app (WhatsApp, Slack, Instagram, …) intentionally hard-code
 * their own brand palette and don't read from this hook — they only use it
 * to drive the navigation header so the chrome around them stays consistent.
 *
 * Driven by RN's `useColorScheme`, which already follows the OS-level
 * appearance setting (Settings → Display → Light/Dark on both iOS and
 * Android). No app-level override is exposed; the example tracks the host
 * OS automatically.
 */
export type ExampleTheme = {
  scheme: 'light' | 'dark';
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textDim: string;
  accent: string;
  accentText: string;
  danger: string;
  /** Header & status-bar colors for the React Navigation header. */
  headerBg: string;
  headerText: string;
  /** Status-bar bar style hint. */
  barStyle: 'light-content' | 'dark-content';
};

const LIGHT: ExampleTheme = {
  scheme: 'light',
  bg: '#f5f6f7',
  surface: '#ffffff',
  surfaceAlt: '#eceff4',
  border: '#d8dadd',
  text: '#1a1a1a',
  textDim: '#5f6368',
  accent: '#0a7aff',
  accentText: '#ffffff',
  danger: '#ff3b30',
  headerBg: '#ffffff',
  headerText: '#1a1a1a',
  barStyle: 'dark-content',
};

const DARK: ExampleTheme = {
  scheme: 'dark',
  bg: '#000000',
  surface: '#1c1c1e',
  surfaceAlt: '#0a0a0b',
  border: '#2c2c2e',
  text: '#ffffff',
  textDim: '#9aa0a6',
  accent: '#3478f6',
  accentText: '#ffffff',
  danger: '#ff453a',
  headerBg: '#0a0a0b',
  headerText: '#ffffff',
  barStyle: 'light-content',
};

/** React hook: returns the current palette for the device's color scheme. */
export function useExampleTheme(): ExampleTheme {
  const scheme = useColorScheme();
  return scheme === 'dark' ? DARK : LIGHT;
}

/**
 * Per-recipe override palette. Recipe screens are themed after specific
 * social-media apps (so e.g. WhatsApp stays dark-green even on a light
 * device) — we just need a small palette to drive the navigation header
 * for each so the surrounding chrome doesn't visually clash.
 */
export const RECIPE_HEADER_THEMES = {
  whatsapp: { bg: '#0b141a', text: '#e9edef', bar: 'light-content' },
  messenger: { bg: '#0e1218', text: '#e5e8eb', bar: 'light-content' },
  instagram: { bg: '#000000', text: '#ffffff', bar: 'light-content' },
  slack: { bg: '#1a1d21', text: '#e8e8e8', bar: 'light-content' },
  tiktok: { bg: '#000000', text: '#ffffff', bar: 'light-content' },
  zalo: { bg: '#ffffff', text: '#1a1a1a', bar: 'dark-content' },
} as const;
