import { resolve } from 'node:path';

import mdx from '@mdx-js/rollup';
import rehypeShiki from '@shikijs/rehype';
import react from '@vitejs/plugin-react';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
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
          return undefined;
        },
      },
    },
  },
});
