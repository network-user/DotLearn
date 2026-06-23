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

import { remarkConceptLinks } from './remark-concept-links.mjs';

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
  "connect-src 'self' http://localhost:* ws://localhost:* wss://localhost:*",
].join('; ');

const PYODIDE_RUNTIME_FILES = [
  'pyodide.asm.js',
  'pyodide.asm.wasm',
  'python_stdlib.zip',
  'pyodide-lock.json',
] as const;

// Extra Pyodide packages shipped to the browser beyond the core runtime.
// sqlite3 is an unvendored stdlib module used by the python-orm topic: the
// worker calls loadPackagesFromImports, but it can only fetch the package if
// its .zip is actually served. The core 4 files alone leave `import sqlite3`
// failing with ModuleNotFoundError in the browser (Node validator is fine
// because it loads the full distribution straight from node_modules).
const PYODIDE_EXTRA_PACKAGES = ['sqlite3'] as const;

// Resolve curated packages to their on-disk file names, pulling transitive
// `depends` from pyodide-lock.json so a package's dependencies ship too.
const resolvePyodidePackageFiles = (pyodideDir: string): string[] => {
  const lock = JSON.parse(readFileSync(join(pyodideDir, 'pyodide-lock.json'), 'utf8')) as {
    packages?: Record<string, { file_name: string; depends?: string[] }>;
  };
  const packages = lock.packages ?? {};
  const seen = new Set<string>();
  const files = new Set<string>();
  const visit = (name: string): void => {
    if (seen.has(name)) return;
    seen.add(name);
    const entry = packages[name];
    if (!entry) return;
    files.add(entry.file_name);
    for (const dep of entry.depends ?? []) visit(dep);
  };
  for (const name of PYODIDE_EXTRA_PACKAGES) visit(name);
  return [...files];
};

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
        remarkPlugins: [remarkFrontmatter, remarkGfm, remarkMdxFrontmatter, remarkConceptLinks],
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
      registerType: 'prompt',
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
        globPatterns: ['**/*.{css,html,svg,woff2}'],
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
          {
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin && url.pathname.startsWith('/assets/') && url.pathname.endsWith('.js'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'app-chunks',
              expiration: {
                maxEntries: 400,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
              cacheableResponse: {
                statuses: [0, 200],
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
    modulePreload: {
      resolveDependencies: (_filename, deps) =>
        deps.filter((dep) => !/interview-(data|flashcards)/.test(dep)),
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          const normalized = id.replace(/\\/g, '/');
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
