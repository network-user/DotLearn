import type { Exercise } from '@dotlearn/contracts';
import { describe, expect, it } from 'vitest';

import { inlineJavascriptRuntime } from '../runtime/javascript';

import { runExercise } from './dispatch';

const theoryQuiz: Exercise = {
  id: 'q1',
  concept: 'basics',
  difficulty: 1,
  prompt: 'Pick the answer',
  type: 'theory-quiz',
  choices: [
    { id: 'a', text: 'A' },
    { id: 'b', text: 'B' },
  ],
  correct: ['a'],
};

const sqlExercise: Exercise = {
  id: 's1',
  concept: 'basics',
  difficulty: 1,
  prompt: 'Write SQL',
  type: 'sql-query',
  fixture: 'CREATE TABLE t(x);',
  expected: { kind: 'scalar', value: 1 },
  solution: 'SELECT 1;',
};

const pythonExercise: Exercise = {
  id: 'p1',
  concept: 'basics',
  difficulty: 1,
  prompt: 'Implement add',
  type: 'python-function',
  starter: 'def add(a, b):\n    pass',
  cases: [{ call: 'add(1, 2)', expect: 3 }],
  solution: 'def add(a, b):\n    return a + b',
};

const jsExercise: Exercise = {
  id: 'j1',
  concept: 'basics',
  difficulty: 1,
  prompt: 'Implement add',
  type: 'javascript-function',
  starter: 'function add() {}',
  cases: [{ call: 'add(1, 2)', expect: 3 }],
  solution: 'function add(a, b) { return a + b; }',
};

const fillInBlanks: Exercise = {
  id: 'f1',
  concept: 'basics',
  difficulty: 1,
  prompt: 'Fill the blank',
  type: 'fill-in-blanks',
  template: 'x __1__',
  blanks: { 1: { accept: ['y'] } },
};

describe('runExercise', () => {
  it('rejects a non-array answer for theory-quiz', async () => {
    expect((await runExercise(theoryQuiz, 'a')).ok).toBe(false);
  });

  it('rejects a non-string answer for sql-query', async () => {
    expect((await runExercise(sqlExercise, 123)).ok).toBe(false);
  });

  it('fails sql-query when no sql runtime is provided', async () => {
    const result = await runExercise(sqlExercise, 'SELECT 1;');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.reason).toContain('sql runtime not provided');
  });

  it('fails python-function when no python runtime is provided', async () => {
    const result = await runExercise(pythonExercise, 'def add(a, b):\n    return a + b');
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.reason).toContain('python runtime not provided');
  });

  it('rejects a non-record answer for fill-in-blanks', async () => {
    expect((await runExercise(fillInBlanks, 'not-a-record')).ok).toBe(false);
  });

  it('delegates javascript-function to the provided runtime', async () => {
    const result = await runExercise(jsExercise, 'function add(a, b) { return a + b; }', {
      javascript: inlineJavascriptRuntime,
    });
    expect(result.ok).toBe(true);
  });
});
