import { resolve } from 'node:path';

import mdx from '@mdx-js/rollup';
import rehypeShiki from '@shikijs/rehype';
import react from '@vitejs/plugin-react';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

import { topicStatsPlugin } from './vite-plugin-topic-stats';

export default defineConfig({
  plugins: [
    topicStatsPlugin(),
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
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/pyodide\//,
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
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('monaco-editor')) return 'monaco';
          if (id.includes('@monaco-editor/react')) return 'monaco';
          if (id.includes('sql.js')) return 'sqljs';
          if (id.includes('pyodide')) return 'pyodide';
          if (id.includes('shiki') || id.includes('@shikijs')) return 'shiki';
          if (id.includes('framer-motion')) return 'motion';
          if (id.includes('@radix-ui')) return 'radix';
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
