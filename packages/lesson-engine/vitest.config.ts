import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    globals: false,
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      // Guard the already-tested grading/runner/loader logic against regression.
      // all:false keeps the gate scoped to files the suite actually exercises,
      // rather than dragging in the pyodide/sql runtimes that can't run in unit tests.
      all: false,
      reporter: ['text-summary'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/index.ts', 'src/node.ts'],
      // Set just under measured coverage (stmts/lines ~71%, branches ~73%, fns ~83%)
      // so the gate catches regressions without flaking on small refactors.
      thresholds: {
        statements: 68,
        branches: 70,
        functions: 78,
        lines: 68,
      },
    },
  },
});
