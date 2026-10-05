import { readFileSync } from 'node:fs';
import {
  type DefaultTheme,
  type HeadConfig,
  type PageData,
  defineConfig,
} from 'vitepress';

const repo = 'https://github.com/maitrungduc1410/react-native-waveform-recorder';
const playerSite = 'https://maitrungduc1410.github.io/react-native-waveform-player/';
const base = '/react-native-waveform-recorder/';
// Production origin + base. Sitemap URLs and canonical links are built from it.
const site = `https://maitrungduc1410.github.io${base}`;
const { version } = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8')
) as { version: string };

// Written by `yarn api` (TypeDoc) before VitePress runs.
const apiSidebar = JSON.parse(
  readFileSync(new URL('../api/typedoc-sidebar.json', import.meta.url), 'utf8')
) as DefaultTheme.SidebarItem[];

const slugs = [
  '',
  'installation',
  'quick-start',
  'demo',
  'props',
  'events',
  'ref-methods',
  'segments',
  'gestures',
  'silence-detection',
  'export',
  'pcm-stream',
  'platform-notes',
  'troubleshooting',
] as const;

type Labels = {
  guide: string;
  api: string;
  player: string;
  groups: [string, string, string, string];
  pages: Record<(typeof slugs)[number], string>;
};

const groups: (typeof slugs)[number][][] = [
  ['', 'installation', 'quick-start', 'demo'],
  ['props', 'events', 'ref-methods'],
  ['segments', 'gestures', 'silence-detection', 'export', 'pcm-stream'],
  ['platform-notes', 'troubleshooting'],
];

function guideSidebar(prefix: string, l: Labels): DefaultTheme.SidebarItem[] {
  return groups.map((group, i) => ({
    text: l.groups[i],
    items: group.map((slug) => ({
      text: l.pages[slug],
      link: `${prefix}/guide/${slug}`,
    })),
  }));
}

function themeConfig(prefix: string, l: Labels): DefaultTheme.Config {
  return {
    nav: [
      {
        text: l.guide,
        link: `${prefix}/guide/`,
        activeMatch: `^${prefix}/guide/`,
      },
      { text: l.api, link: '/api/', activeMatch: '^/api/' },
      {
        text: `v${version}`,
        items: [
          {
            text: 'npm',
            link: 'https://www.npmjs.com/package/react-native-waveform-recorder',
          },
          { text: l.player, link: playerSite },
        ],
      },
    ],
    sidebar: {
      [`${prefix}/guide/`]: guideSidebar(prefix, l),
      '/api/': [{ text: l.api, link: '/api/', items: apiSidebar }],
    },
  };
}

const en: Labels = {
  guide: 'Guide',
  api: 'API reference',
  player: 'Waveform Player docs',
  groups: ['Introduction', 'Component API', 'Features', 'Platforms'],
  pages: {
    '': 'What is it?',
    'installation': 'Installation',
    'quick-start': 'Quick start',
    'demo': 'Browser demo',
    'props': 'Props',
    'events': 'Events',
    'ref-methods': 'Ref methods',
    'segments': 'Segments, pause and preview',
    'gestures': 'Slide gestures',
    'silence-detection': 'Silence detection',
    'export': 'Export and the player',
    'pcm-stream': 'PCM stream',
    'platform-notes': 'Platform notes',
    'troubleshooting': 'Troubleshooting',
  },
};

const vi: Labels = {
  guide: 'Hướng dẫn',
  api: 'Tài liệu API',
  player: 'Tài liệu Waveform Player',
  groups: ['Giới thiệu', 'API của component', 'Tính năng', 'Nền tảng'],
  pages: {
    '': 'Tổng quan',
    'installation': 'Cài đặt',
    'quick-start': 'Bắt đầu nhanh',
    'demo': 'Demo trên trình duyệt',
    'props': 'Props',
    'events': 'Sự kiện',
    'ref-methods': 'Phương thức của ref',
    'segments': 'Đoạn ghi, tạm dừng và nghe lại',
    'gestures': 'Cử chỉ trượt',
    'silence-detection': 'Phát hiện khoảng lặng',
    'export': 'Dữ liệu xuất và trình phát',
    'pcm-stream': 'Luồng PCM',
    'platform-notes': 'Lưu ý theo nền tảng',
    'troubleshooting': 'Khắc phục sự cố',
  },
};

const zh: Labels = {
  guide: '指南',
  api: 'API 参考',
  player: 'Waveform Player 文档',
  groups: ['入门', '组件 API', '功能', '平台'],
  pages: {
    '': '概览',
    'installation': '安装',
    'quick-start': '快速开始',
    'demo': '浏览器演示',
    'props': '属性',
    'events': '事件',
    'ref-methods': 'ref 方法',
    'segments': '分段、暂停与预览',
    'gestures': '滑动手势',
    'silence-detection': '静音检测',
    'export': '导出数据与播放器',
    'pcm-stream': 'PCM 流',
    'platform-notes': '平台说明',
    'troubleshooting': '故障排查',
  },
};

// SEO: locale metadata used for hreflang, og:locale and the preview image alt text.
const seoLocales = {
  root: {
    prefix: '',
    lang: 'en-US',
    og: 'en_US',
    imageAlt:
      'React Native Waveform Recorder: a recording pill with a red record dot, live waveform bars and a running timer',
  },
  vi: {
    prefix: 'vi/',
    lang: 'vi-VN',
    og: 'vi_VN',
    imageAlt:
      'React Native Waveform Recorder: thanh ghi âm có chấm đỏ, các cột waveform trực tiếp và đồng hồ đang chạy',
  },
  zh: {
    prefix: 'zh/',
    lang: 'zh-CN',
    og: 'zh_CN',
    imageAlt:
      'React Native Waveform Recorder：带红色录音指示点、实时波形条和计时器的录音条',
  },
} as const;
type SeoLocale = keyof typeof seoLocales;

function localeOf(page: string): SeoLocale {
  const first = page.split('/')[0];
  return first === 'vi' || first === 'zh' ? first : 'root';
}

/** `vi/guide/index.md` -> `vi/guide/`, `api/foo/bar.md` -> `api/foo/bar`. */
function pageUrl(page: string): string {
  return page.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '');
}

/** Description for generated TypeDoc pages, which have no frontmatter. */
function apiDescription(relativePath: string): string | undefined {
  const lib = 'react-native-waveform-recorder';
  if (relativePath === 'api/index.md') {
    return `API reference for ${lib}: the recorder component, its props, events and ref type, plus the PCM stream helpers, generated from the TypeScript source.`;
  }
  if (relativePath === `api/${lib}/index.md`) {
    return `API reference for the main ${lib} entry point: WaveformRecorderView, its props, ref methods, event payloads and ensureMicrophonePermission.`;
  }
  if (relativePath === `api/${lib}/pcm-stream/index.md`) {
    return `API reference for ${lib}/pcm-stream: helpers that decode onPcmChunk payloads into Int16 and mono Float32 samples.`;
  }
  const m = relativePath.match(
    /^api\/react-native-waveform-recorder\/(?:pcm-stream\/)?([\w-]+)\/([^/]+)\.md$/
  );
  if (!m) return undefined;
  const [, kind, name] = m;
  switch (kind) {
    case 'functions':
      return `API reference for ${name}() in ${lib}: signature, parameters, return value and behaviour on each platform.`;
    case 'variables':
      return `API reference for the ${name} component in ${lib}: the native recorder view with a live waveform, preview and slide gestures.`;
    case 'type-aliases':
      if (name.endsWith('Event')) {
        return `API reference for the ${name} payload in ${lib}, listing every field the native recorder sends with this event.`;
      }
      return `API reference for the ${name} type in ${lib}, with its full TypeScript definition and what each member means.`;
    default:
      return undefined;
  }
}

export default defineConfig({
  title: 'React Native Waveform Recorder',
  description:
    'Native audio recorder for React Native with a live waveform, pause and resume, preview, slide gestures, silence detection and a 64-bucket export.',
  base,
  cleanUrls: true,
  lastUpdated: true,
  appearance: 'dark',
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: `${base}logo.svg` }],
    [
      'link',
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: `${base}apple-touch-icon.png`,
      },
    ],
    ['meta', { name: 'theme-color', content: '#DC2626' }],
    [
      'meta',
      {
        name: 'google-site-verification',
        content: 'tQKWpMESb7_XYCOMCID91lFgoQ4_dt3sqGoXzuRu-ZQ',
      },
    ],
  ],
  sitemap: {
    // VitePress 1.6 builds item URLs without `base`, so the hostname carries it.
    hostname: site,
    transformItems: (items) =>
      items.map((item) => {
        const en = item.links?.find((l) => l.lang === seoLocales.root.lang);
        return en
          ? { ...item, links: [...item.links!, { lang: 'x-default', url: en.url }] }
          : item;
      }),
  },
  transformPageData(pageData: PageData) {
    const description = apiDescription(pageData.relativePath);
    if (description && !pageData.frontmatter.description) {
      return {
        description,
        frontmatter: { ...pageData.frontmatter, description },
      };
    }
  },
  transformHead({ page, pageData, siteConfig, title, description }) {
    if (page === '404.md' || pageData.isNotFound) {
      return [['meta', { name: 'robots', content: 'noindex' }]];
    }
    const locale = localeOf(page);
    const key = locale === 'root' ? page : page.slice(locale.length + 1);
    const url = site + pageUrl(page);
    const exists = new Set(siteConfig.pages);
    const variants = (Object.keys(seoLocales) as SeoLocale[]).filter((l) =>
      exists.has(seoLocales[l].prefix + key)
    );
    const isHome = pageData.frontmatter.layout === 'home';
    const image = `${site}og.png`;
    const imageAlt = seoLocales[locale].imageAlt;

    const head: HeadConfig[] = [['link', { rel: 'canonical', href: url }]];
    if (variants.length > 1) {
      for (const l of variants) {
        head.push([
          'link',
          {
            rel: 'alternate',
            hreflang: seoLocales[l].lang,
            href: site + pageUrl(seoLocales[l].prefix + key),
          },
        ]);
      }
      if (variants.includes('root')) {
        head.push([
          'link',
          { rel: 'alternate', hreflang: 'x-default', href: site + pageUrl(key) },
        ]);
      }
    }
    const og: [string, string][] = [
      ['og:type', isHome ? 'website' : 'article'],
      ['og:site_name', 'React Native Waveform Recorder'],
      ['og:title', title],
      ['og:description', description],
      ['og:url', url],
      ['og:locale', seoLocales[locale].og],
      ...variants
        .filter((l) => l !== locale)
        .map((l): [string, string] => ['og:locale:alternate', seoLocales[l].og]),
      ['og:image', image],
      ['og:image:type', 'image/png'],
      ['og:image:width', '1200'],
      ['og:image:height', '630'],
      ['og:image:alt', imageAlt],
    ];
    for (const [property, content] of og) {
      head.push(['meta', { property, content }]);
    }
    const twitter: [string, string][] = [
      ['twitter:card', 'summary_large_image'],
      ['twitter:title', title],
      ['twitter:description', description],
      ['twitter:image', image],
      ['twitter:image:alt', imageAlt],
    ];
    for (const [name, content] of twitter) {
      head.push(['meta', { name, content }]);
    }
    return head;
  },
  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
      themeConfig: themeConfig('', en),
    },
    vi: {
      label: 'Tiếng Việt',
      lang: 'vi-VN',
      title: 'React Native Waveform Recorder',
      description:
        'Thư viện ghi âm native cho React Native: waveform trực tiếp, tạm dừng và ghi tiếp, nghe lại, cử chỉ trượt, phát hiện khoảng lặng và dữ liệu 64 cột.',
      themeConfig: {
        ...themeConfig('/vi', vi),
        outline: { level: [2, 3], label: 'Trên trang này' },
        docFooter: { prev: 'Trang trước', next: 'Trang sau' },
        lastUpdated: { text: 'Cập nhật lần cuối' },
        editLink: {
          pattern: `${repo}/edit/master/docs/:path`,
          text: 'Sửa trang này trên GitHub',
        },
        returnToTopLabel: 'Về đầu trang',
        sidebarMenuLabel: 'Menu',
        darkModeSwitchLabel: 'Giao diện',
        lightModeSwitchTitle: 'Chuyển sang giao diện sáng',
        darkModeSwitchTitle: 'Chuyển sang giao diện tối',
        langMenuLabel: 'Đổi ngôn ngữ',
        notFound: {
          title: 'KHÔNG TÌM THẤY TRANG',
          quote: 'Trang bạn tìm không tồn tại hoặc đã được chuyển đi.',
          linkText: 'Về trang chủ',
        },
        footer: { message: 'Phát hành theo giấy phép MIT.' },
      },
    },
    zh: {
      label: '简体中文',
      lang: 'zh-CN',
      title: 'React Native Waveform Recorder',
      description:
        'React Native 原生录音组件：实时波形、暂停与继续录音、录音预览、滑动手势、静音检测，以及 64 段波形数据导出。',
      themeConfig: {
        ...themeConfig('/zh', zh),
        outline: { level: [2, 3], label: '页面导航' },
        docFooter: { prev: '上一页', next: '下一页' },
        lastUpdated: { text: '最后更新于' },
        editLink: {
          pattern: `${repo}/edit/master/docs/:path`,
          text: '在 GitHub 上编辑此页',
        },
        returnToTopLabel: '回到顶部',
        sidebarMenuLabel: '菜单',
        darkModeSwitchLabel: '外观',
        lightModeSwitchTitle: '切换到浅色模式',
        darkModeSwitchTitle: '切换到深色模式',
        langMenuLabel: '切换语言',
        notFound: {
          title: '页面未找到',
          quote: '你访问的页面不存在或已被移动。',
          linkText: '返回首页',
        },
        footer: { message: '基于 MIT 许可证发布。' },
      },
    },
  },
  themeConfig: {
    logo: '/logo.svg',
    socialLinks: [{ icon: 'github', link: repo }],
    search: {
      provider: 'local',
      options: {
        locales: {
          vi: {
            translations: {
              button: { buttonText: 'Tìm kiếm', buttonAriaLabel: 'Tìm kiếm' },
              modal: {
                displayDetails: 'Hiển thị chi tiết',
                resetButtonTitle: 'Xóa tìm kiếm',
                backButtonTitle: 'Đóng tìm kiếm',
                noResultsText: 'Không có kết quả cho',
                footer: {
                  selectText: 'chọn',
                  navigateText: 'di chuyển',
                  closeText: 'đóng',
                },
              },
            },
          },
          zh: {
            translations: {
              button: { buttonText: '搜索', buttonAriaLabel: '搜索' },
              modal: {
                displayDetails: '显示详情',
                resetButtonTitle: '清除查询',
                backButtonTitle: '关闭搜索',
                noResultsText: '没有找到相关结果',
                footer: {
                  selectText: '选择',
                  navigateText: '切换',
                  closeText: '关闭',
                },
              },
            },
          },
        },
      },
    },
    editLink: {
      // Serialized into the client bundle, so it cannot use variables from this file. API pages
      // are generated from the doc comments in src.
      pattern: ({ filePath }) =>
        filePath.startsWith('api/')
          ? 'https://github.com/maitrungduc1410/react-native-waveform-recorder/tree/master/src'
          : `https://github.com/maitrungduc1410/react-native-waveform-recorder/edit/master/docs/${filePath}`,
      text: 'Edit this page on GitHub',
    },
    outline: { level: [2, 3] },
    footer: { message: 'Released under the MIT License.' },
  },
});
