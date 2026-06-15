import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

import mdx from '@mdx-js/rollup';
import rehypeShiki from '@shikijs/rehype';
import react from '@vitejs/plugin-react';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

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
  "connect-src 'self' https://api.anthropic.com https://api.openai.com https://openrouter.ai http://localhost:* ws://localhost:* wss://localhost:*",
].join('; ');

const PYODIDE_RUNTIME_FILES = [
  'pyodide.asm.js',
  'pyodide.asm.wasm',
  'python_stdlib.zip',
  'pyodide-lock.json',
] as const;

const pyodideContentType = (name: string): string => {
  if (name.endsWith('.wasm')) return 'application/wasm';
  if (name.endsWith('.js')) return 'text/javascript';
  if (name.endsWith('.json')) return 'application/json';
  if (name.endsWith('.zip')) return 'application/zip';
  return 'application/octet-stream';
};

const pyodideAssetsPlugin = (): Plugin => {
  const require = createRequire(import.meta.url);
  const pyodideDir = dirname(require.resolve('pyodide/package.json'));
  const filePath = (name: string): string => join(pyodideDir, name);
  return {
    name: 'dotlearn-pyodide-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url ?? '').split('?')[0];
        const match = /\/pyodide\/([^/]+)$/.exec(path);
        const name = match?.[1];
        if (!name || !PYODIDE_RUNTIME_FILES.includes(name as (typeof PYODIDE_RUNTIME_FILES)[number])) {
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
      for (const name of PYODIDE_RUNTIME_FILES) {
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

export default defineConfig({
  plugins: [
    cspPlugin(),
    pyodideAssetsPlugin(),
    topicManifestsPlugin(),
    topicStatsPlugin(),
    searchIndexPlugin(),
    {
      enforce: 'pre',
      ...mdx({
        remarkPlugins: [remarkFrontmatter, remarkGfm, remarkMdxFrontmatter],
        rehypePlugins: [
          [
            rehypeShiki,
            {
              themes: { light: 'vitesse-light', dark: 'vesper' },
              defaultColor: false,
              cssVariablePrefix: '--shiki-',
            },
          ],
        ],
        providerImportSource: '@mdx-js/react',
      }),
    },
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: '.learn',
        short_name: '.learn',
        description: 'Local-first learning workbench',
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
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2,wasm}'],
        globIgnores: ['**/pyodide/**'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/pyodide\//],
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
                statuses: [0, 200],
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
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          const normalized = id.replace(/\\/g, '/');
          if (normalized.includes('/src/lib/interview.ts')) return 'interview-data';
          if (normalized.includes('\0virtual:search-index')) return 'search-index';
          if (normalized.includes('\0virtual:topic-manifests')) return 'topic-manifests';
          if (id.includes('monaco-editor')) return 'monaco';
          if (id.includes('@monaco-editor/react')) return 'monaco';
          if (id.includes('sql.js')) return 'sqljs';
          if (id.includes('pyodide')) return 'pyodide';
          if (id.includes('framer-motion')) return 'motion';
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
