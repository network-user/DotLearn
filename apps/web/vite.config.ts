import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import mdx from '@mdx-js/rollup';
import rehypeShiki from '@shikijs/rehype';
import react from '@vitejs/plugin-react';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

import { resolvePyodideDir, resolvePyodideExtraPackageEntries } from './pyodide-packages.mjs';
import { remarkConceptLinks } from './remark-concept-links.mjs';
import { INK_THEME, PAPER_THEME } from './src/lib/shiki-themes';

import { searchIndexPlugin } from './vite-plugin-search-index';
import { topicManifestsPlugin } from './vite-plugin-topic-manifests';
import { topicStatsPlugin } from './vite-plugin-topic-stats';

const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "manifest-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "connect-src 'self'",
].join('; ');

const PYODIDE_RUNTIME_FILES = [
  'pyodide.asm.js',
  'pyodide.asm.wasm',
  'python_stdlib.zip',
  'pyodide-lock.json',
] as const;

// sqlite3 is an unvendored stdlib module used by the python-orm topic: the
// worker calls loadPackagesFromImports, but it can only fetch the package if
// its .zip is actually served. The core 4 files alone leave `import sqlite3`
// failing with ModuleNotFoundError in the browser (Node validator is fine
// because it loads the full distribution straight from node_modules). The
// "prebuild" script (scripts/fetch-pyodide-extra-packages.mjs) downloads it
// into node_modules/pyodide before this plugin ever runs.
const resolvePyodidePackageFiles = (pyodideDir: string): string[] =>
  resolvePyodideExtraPackageEntries(pyodideDir).map(
    (entry: { file_name: string }) => entry.file_name,
  );

const pyodideContentType = (name: string): string => {
  if (name.endsWith('.wasm')) return 'application/wasm';
  if (name.endsWith('.js')) return 'text/javascript';
  if (name.endsWith('.json')) return 'application/json';
  if (name.endsWith('.zip')) return 'application/zip';
  return 'application/octet-stream';
};

const pyodideAssetsPlugin = (): Plugin => {
  const pyodideDir = resolvePyodideDir(__dirname);
  const filePath = (name: string): string => join(pyodideDir, name);
  const servedFiles = new Set<string>([
    ...PYODIDE_RUNTIME_FILES,
    ...resolvePyodidePackageFiles(pyodideDir),
  ]);
  return {
    name: 'dotlearn-pyodide-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0];
        const match = /\/pyodide\/([^/]+)$/.exec(path);
        const name = match?.[1];
        if (!name || !servedFiles.has(name)) {
          next();
          return;
        }
        try {
          const body = readFileSync(filePath(name));
          res.setHeader('Content-Type', pyodideContentType(name));
          res.setHeader('Cache-Control', 'no-cache');
          res.end(body);
        } catch {
          next();
        }
      });
    },
    generateBundle() {
      for (const name of servedFiles) {
        this.emitFile({
          type: 'asset',
          fileName: `pyodide/${name}`,
          source: readFileSync(filePath(name)),
        });
      }
    },
  };
};

const cspPlugin = (): Plugin => ({
  name: 'dotlearn-csp',
  apply: 'build',
  transformIndexHtml(html) {
    return {
      html,
      tags: [
        {
          tag: 'meta',
          attrs: {
            'http-equiv': 'Content-Security-Policy',
            content: CONTENT_SECURITY_POLICY,
          },
          injectTo: 'head-prepend',
        },
      ],
    };
  },
});

// Трекер аналитики Umami (self-hosted). Тег добавляется в <head> собранного
// shell (prerender размножает его по всем страницам). Включается ТОЛЬКО когда
// задан VITE_UMAMI_WEBSITE_ID (в проде - build-arg через Dockerfile ENV); без
// него скрипт не рендерится - локальная сборка/CI ничего не шлют.
//
// Отдаётся first-party через nginx (/stats/script.js, /stats/api/send -> umami),
// поэтому CSP менять не нужно: script-src/connect-src остаются 'self'. host-url
// указывает на каталог трекера на нашем домене, чтобы события уходили на тот же
// проксируемый путь (…/api/send), а не на голый origin. domains ограничивает
// отправку продакшн-хостом. Origin берём из VITE_SITE_URL, иначе VITE_API_BASE
// (публичный адрес сайта, api живёт с ним на одном домене за nginx).
const umamiPlugin = (): Plugin => {
  const websiteId = (process.env.VITE_UMAMI_WEBSITE_ID ?? '').trim();
  const src = (process.env.VITE_UMAMI_SRC ?? '').trim() || '/stats/script.js';
  const origin = (process.env.VITE_SITE_URL ?? process.env.VITE_API_BASE ?? '').trim();
  return {
    name: 'dotlearn-umami',
    apply: 'build',
    transformIndexHtml(html) {
      if (!websiteId) return html;
      const attrs: Record<string, string | boolean> = {
        defer: true,
        src,
        'data-website-id': websiteId,
      };
      const dir = src.replace(/\/[^/]*$/, '') || '/stats';
      if (origin) {
        try {
          attrs['data-host-url'] = new URL(dir, origin).toString().replace(/\/$/, '');
          attrs['data-domains'] = new URL(origin).host;
        } catch {
          // Кривой origin - оставляем без host-url/domains; трекер возьмёт
          // origin самого скрипта (тот же домен), это тоже first-party.
        }
      }
      return { html, tags: [{ tag: 'script', attrs, injectTo: 'head' }] };
    },
  };
};

export default defineConfig({
  plugins: [
    cspPlugin(),
    umamiPlugin(),
    pyodideAssetsPlugin(),
    topicManifestsPlugin(),
    topicStatsPlugin(),
    searchIndexPlugin(),
    {
      enforce: 'pre',
      ...mdx({
        remarkPlugins: [remarkFrontmatter, remarkGfm, remarkMdxFrontmatter, remarkConceptLinks],
        rehypePlugins: [
          [
            rehypeShiki,
            {
              themes: { light: PAPER_THEME, dark: INK_THEME },
              defaultColor: false,
              cssVariablePrefix: '--shiki-',
              addLanguageClass: true,
            },
          ],
        ],
        providerImportSource: '@mdx-js/react',
      }),
    },
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: '.learn',
        short_name: '.learn',
        description:
          'Интерактивная платформа обучения: Python, SQL, Git и веб-разработка. Работает офлайн, без регистрации.',
        categories: ['education'],
        lang: 'ru',
        start_url: '/',
        display: 'standalone',
        background_color: '#181410',
        theme_color: '#181410',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{css,html,svg,woff2}'],
        globIgnores: [
          '**/pyodide/**',
          'topics/**',
          'en/**',
          'flashcards/**',
          'glossary/**',
          'interview/**',
          'tracks/**',
          'map/**',
          'sandbox/**',
          '404.html',
          '**/*.md',
          'llms.txt',
          'llms-full.txt',
          'og/**',
        ],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/pyodide\//, /^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/pyodide/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'pyodide-runtime',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 90,
              },
              cacheableResponse: {
                statuses: [200],
              },
            },
          },
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && url.pathname.startsWith('/assets/') && url.pathname.endsWith('.js'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'app-chunks',
              expiration: {
                maxEntries: 1600,
                maxAgeSeconds: 60 * 60 * 24 * 30,
                purgeOnQuotaError: true,
              },
              cacheableResponse: {
                statuses: [200],
              },
            },
          },
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && url.pathname.startsWith('/assets/') && url.pathname.endsWith('.wasm'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'app-wasm',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 90,
              },
              cacheableResponse: {
                statuses: [200],
              },
            },
          },
        ],
      },
    }),
    ...(process.env.ANALYZE
      ? [
          visualizer({
            filename: 'dist/bundle-stats.html',
            gzipSize: true,
            brotliSize: true,
            template: 'treemap',
          }) as unknown as Plugin,
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  worker: {
    format: 'es',
  },
  server: {
    port: 5173,
    fs: {
      allow: [resolve(__dirname, '../..')],
    },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    // Пик памяти сборки был на "computing gzip size" (гзип всех чанков ради
    // отчёта). На большом бандле (~9000 модулей из interview-MDX) это роняло
    // build в OOM. Отчёт косметический - отключаем, экономим память и время.
    reportCompressedSize: false,
    modulePreload: {
      resolveDependencies: (_filename, deps) =>
        deps.filter((dep) => !/interview-(data|flashcards)/.test(dep)),
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          const normalized = id.replace(/\\/g, '/');
          if (
            normalized.includes('vite/preload-helper') ||
            normalized.includes('vite/modulepreload-polyfill')
          ) {
            return 'react';
          }
          if (normalized.includes('/packages/contracts/') || id.includes('node_modules/zod')) {
            return 'contracts';
          }
          if (normalized.includes('/packages/lesson-engine/')) return 'lesson-engine';
          if (normalized.includes('/src/lib/interview.ts')) return 'interview-data';
          if (normalized.includes('\0virtual:search-index/en')) return 'search-index-en';
          if (normalized.includes('\0virtual:search-index')) return 'search-index-ru';
          if (normalized.includes('\0virtual:topic-manifests')) return 'topic-manifests';
          if (id.includes('monaco-editor')) return 'monaco';
          if (id.includes('@monaco-editor/react')) return 'monaco';
          if (id.includes('sql.js')) return 'sqljs';
          if (id.includes('pyodide')) return 'pyodide';
          if (id.includes('@radix-ui')) return 'radix';
          if (id.includes('cmdk')) return 'cmdk';
          if (id.includes('sonner')) return 'sonner';
          if (id.includes('@mdx-js')) return 'mdx';
          if (id.includes('ts-fsrs')) return 'fsrs';
          if (id.includes('canvas-confetti')) return 'confetti';
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'react';
          }
          if (id.includes('@tanstack')) return 'router';
          if (id.includes('i18next')) return 'i18n';
          if (id.includes('node_modules/dexie')) return 'dexie';
          if (id.includes('lucide-react')) return 'icons';
          return undefined;
        },
      },
    },
  },
});
