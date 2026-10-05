import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';
import { h } from 'vue';
import HeroArt from './components/HeroArt.vue';
import RecorderDemo from './components/RecorderDemo.vue';
import './style.css';

export default {
  extends: DefaultTheme,
  Layout: () =>
    h(DefaultTheme.Layout, null, { 'home-hero-image': () => h(HeroArt) }),
  enhanceApp({ app }) {
    app.component('RecorderDemo', RecorderDemo);
  },
} satisfies Theme;
