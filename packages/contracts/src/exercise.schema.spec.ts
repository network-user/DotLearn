import { describe, expect, it } from 'vitest';

import {
  Exercise,
  ExerciseFile,
  exerciseVariantCount,
  isInteractiveExercise,
  resolveExerciseVariant,
} from './exercise.schema';

const theoryQuiz = {
  id: 'q1',
  concept: 'intro',
  difficulty: 1,
  prompt: 'Pick the answer',
  type: 'theory-quiz',
  choices: [
    { id: 'a', text: 'A' },
    { id: 'b', text: 'B' },
  ],
  correct: ['a'],
};

const sqlQuery = {
  id: 's1',
  concept: 'intro',
  difficulty: 2,
  prompt: 'Write a query',
  type: 'sql-query',
  fixture: 'CREATE TABLE t(x);',
  expected: { kind: 'scalar', value: 1 },
  solution: 'SELECT 1;',
};

const pythonFn = {
  id: 'p1',
  concept: 'intro',
  difficulty: 2,
  prompt: 'Implement add',
  type: 'python-function',
  starter: 'def add(a, b): ...',
  cases: [{ call: 'add(1, 2)', expect: 3 }],
  solution: 'def add(a, b): return a + b',
};

const javascriptFn = { ...pythonFn, type: 'javascript-function', starter: 'function add() {}' };

const fillInBlanks = {
  id: 'f1',
  concept: 'intro',
  difficulty: 1,
  prompt: 'Fill the blank',
  type: 'fill-in-blanks',
  template: 'SELECT __1__',
  blanks: { 1: { accept: ['*'] } },
};

const predictOutput = {
  id: 'po1',
  concept: 'intro',
  difficulty: 1,
  prompt: 'Predict the output',
  type: 'predict-output',
  snippet: 'print(1)',
  expected: { kind: 'stdout', value: '1\n' },
};

describe('Exercise discriminated union', () => {
  it.each([
    ['theory-quiz', theoryQuiz],
    ['sql-query', sqlQuery],
    ['python-function', pythonFn],
    ['javascript-function', javascriptFn],
    ['fill-in-blanks', fillInBlanks],
    ['predict-output', predictOutput],
  ] as const)('parses a valid %s exercise', (type, fixture) => {
    const result = Exercise.safeParse(fixture);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.type).toBe(type);
  });

  it('rejects an unknown type', () => {
    expect(Exercise.safeParse({ ...theoryQuiz, type: 'mystery' }).success).toBe(false);
  });
});

describe('ExerciseFile', () => {
  it('requires at least one exercise', () => {
    expect(ExerciseFile.safeParse({ exercises: [] }).success).toBe(false);
  });

  it('rejects unknown top-level keys', () => {
    expect(ExerciseFile.safeParse({ exercises: [theoryQuiz], extra: 1 }).success).toBe(false);
  });

  it('accepts a file with one valid exercise', () => {
    expect(ExerciseFile.safeParse({ exercises: [theoryQuiz] }).success).toBe(true);
  });
});

describe('variant helpers', () => {
  const withVariants = {
    ...theoryQuiz,
    variants: [
      {
        choices: [
          { id: 'x', text: 'X' },
          { id: 'y', text: 'Y' },
        ],
        correct: ['y'],
      },
    ],
  };

  it('counts the base plus its variants', () => {
    expect(exerciseVariantCount(Exercise.parse(withVariants))).toBe(2);
    expect(exerciseVariantCount(Exercise.parse(theoryQuiz))).toBe(1);
  });

  it('returns the base for variant index 0 and strips variants', () => {
    const base = resolveExerciseVariant(Exercise.parse(withVariants), 0);
    expect(base.type === 'theory-quiz' && base.correct).toEqual(['a']);
    expect('variants' in base).toBe(false);
  });

  it('merges the chosen variant over the base', () => {
    const v1 = resolveExerciseVariant(Exercise.parse(withVariants), 1);
    expect(v1.type === 'theory-quiz' && v1.correct).toEqual(['y']);
  });

  it('clamps an out-of-range variant index to the last variant', () => {
    const clamped = resolveExerciseVariant(Exercise.parse(withVariants), 99);
    expect(clamped.type === 'theory-quiz' && clamped.correct).toEqual(['y']);
  });

  it('classifies interactive exercises', () => {
    expect(isInteractiveExercise(Exercise.parse(sqlQuery))).toBe(true);
    expect(isInteractiveExercise(Exercise.parse(theoryQuiz))).toBe(false);
  });
});
