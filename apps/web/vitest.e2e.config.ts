import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

// Live integration harness — SEPARATE from vitest.config.ts on purpose.
//
// The normal unit config (vitest.config.ts) runs jsdom + fake-indexeddb over src/**/*.spec.ts
// and src/**/*.test.ts. This config instead drives the REAL sync client modules against a LIVE
// api server over HTTP, simulating two devices. It therefore:
//   - runs in the `node` environment (native fetch / WebCrypto / CompressionStream, no DOM),
//   - loads NO setup files (no fake-indexeddb, no jsdom shims),
//   - includes ONLY e2e/**/*.e2e.ts, which lives OUTSIDE src/ so `pnpm --filter @dotlearn/web
//     test` (vitest.config.ts) can never pick these files up and try to hit a server in CI.
//
// Invoked via `pnpm --filter @dotlearn/web test:e2e:sync`
// (vitest run --config vitest.e2e.config.ts). Base URL from E2E_API_BASE (default :3210).
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    include: ['e2e/**/*.e2e.ts'],
    environment: 'node',
    globals: false,
    // No setupFiles: this suite must NOT load fake-indexeddb/auto or any DOM shim.
    reporters: ['default'],
    // PBKDF2 (100k iterations) + real HTTP round-trips need more headroom than the 5s default.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
