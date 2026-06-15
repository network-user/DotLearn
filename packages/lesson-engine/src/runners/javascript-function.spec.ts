import type { JavascriptFunctionExercise } from '@dotlearn/contracts';
import { describe, expect, it } from 'vitest';

import { inlineJavascriptRuntime } from '../runtime/javascript';

import { runJavascriptFunction } from './javascript-function';

const exercise = (
  overrides: Partial<JavascriptFunctionExercise> = {},
): JavascriptFunctionExercise => ({
  id: 'js1',
  concept: 'basics',
  difficulty: 1,
  prompt: 'Implement add(a, b)',
  type: 'javascript-function',
  starter: 'function add(a, b) {}',
  cases: [
    { call: 'add(1, 2)', expect: 3 },
    { call: 'add(-1, 1)', expect: 0 },
  ],
  solution: 'function add(a, b) { return a + b; }',
  ...overrides,
});

describe('runJavascriptFunction', () => {
  it('passes a correct solution across all cases', async () => {
    const result = await runJavascriptFunction(
      exercise(),
      'function add(a, b) { return a + b; }',
      inlineJavascriptRuntime,
    );
    expect(result).toEqual({ ok: true, details: { casesPassed: 2 } });
  });

  it('fails when a case returns the wrong value', async () => {
    const result = await runJavascriptFunction(
      exercise(),
      'function add(a, b) { return a - b; }',
      inlineJavascriptRuntime,
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.code).toBe('cases-failed');
    expect(result.params).toMatchObject({ failed: 2, total: 2 });
  });

  it('captures a thrown error without crashing the runner', async () => {
    const single = exercise({ cases: [{ call: 'add(1, 2)', expect: 3 }] });
    const result = await runJavascriptFunction(
      single,
      'function add() { throw new Error("boom"); }',
      inlineJavascriptRuntime,
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.details).toMatchObject({ failures: [{ thrown: { message: 'boom' } }] });
  });

  it('supports approximate matching via expect_approx', async () => {
    const approx = exercise({ cases: [{ call: 'divide(1, 3)', expect_approx: 0.333333 }] });
    const result = await runJavascriptFunction(
      approx,
      'function divide(a, b) { return a / b; }',
      inlineJavascriptRuntime,
    );
    expect(result.ok).toBe(true);
  });
});
