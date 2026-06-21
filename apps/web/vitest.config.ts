import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

// Standalone from vite.config.ts on purpose: unit tests must not pull the app's
// MDX / PWA / virtual-module plugins. jsdom + fake-indexeddb (setup file) give the
// IndexedDB and DOM globals that the Dexie-backed progress layer needs.
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'jsdom',
    globals: false,
    setupFiles: ['fake-indexeddb/auto'],
    reporters: ['default'],
  },
});
