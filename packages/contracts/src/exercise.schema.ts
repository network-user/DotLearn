import { z } from 'zod';

import { SLUG_PATTERN } from './topic.schema';

export const ExerciseId = z.string().regex(/^[a-z0-9-]+$/);
export const Difficulty = z.number().int().min(1).max(5);

const BaseExercise = z.object({
  id: ExerciseId,
  concept: z.string().regex(SLUG_PATTERN),
  difficulty: Difficulty,
  prompt: z.string().min(5),
  hints: z.array(z.string()).optional(),
});

const TheoryQuizChoice = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
});

export const TheoryQuizExercise = BaseExercise.extend({
  type: z.literal('theory-quiz'),
  choices: z.array(TheoryQuizChoice).min(2),
  correct: z.array(z.string()).min(1),
  explanation: z.string().optional(),
});
export type TheoryQuizExercise = z.infer<typeof TheoryQuizExercise>;

export const ResultSetExpected = z.object({
  kind: z.literal('result-set'),
  ordered: z.boolean().default(false),
  rows: z.array(z.record(z.string(), z.unknown())),
});

export const ScalarExpected = z.object({
  kind: z.literal('scalar'),
  value: z.unknown(),
});

export const StdoutExpected = z.object({
  kind: z.literal('stdout'),
  value: z.string(),
});

export const SqlQueryExercise = BaseExercise.extend({
  type: z.literal('sql-query'),
  fixture: z.string().min(1),
  expected: z.discriminatedUnion('kind', [ResultSetExpected, ScalarExpected]),
  solution: z.string().min(1),
});
export type SqlQueryExercise = z.infer<typeof SqlQueryExercise>;

export const FunctionCase = z.object({
  call: z.string().min(1),
  expect: z.unknown().optional(),
  expect_approx: z.number().optional(),
});

export const PythonFunctionExercise = BaseExercise.extend({
  type: z.literal('python-function'),
  starter: z.string().min(1),
  cases: z.array(FunctionCase).min(1),
  solution: z.string().min(1),
});
export type PythonFunctionExercise = z.infer<typeof PythonFunctionExercise>;

export const JavascriptFunctionExercise = BaseExercise.extend({
  type: z.literal('javascript-function'),
  starter: z.string().min(1),
  cases: z.array(FunctionCase).min(1),
  solution: z.string().min(1),
});
export type JavascriptFunctionExercise = z.infer<typeof JavascriptFunctionExercise>;

const BlankSpec = z.object({
  accept: z.array(z.string()).optional(),
  accept_regex: z.string().optional(),
});

export const FillInBlanksExercise = BaseExercise.extend({
  type: z.literal('fill-in-blanks'),
  template: z.string().min(1),
  blanks: z.record(z.string(), BlankSpec),
});
export type FillInBlanksExercise = z.infer<typeof FillInBlanksExercise>;

export const PredictOutputExercise = BaseExercise.extend({
  type: z.literal('predict-output'),
  snippet: z.string().min(1),
  fixture: z.string().optional(),
  expected: z.discriminatedUnion('kind', [ResultSetExpected, ScalarExpected, StdoutExpected]),
});
export type PredictOutputExercise = z.infer<typeof PredictOutputExercise>;

export const Exercise = z.discriminatedUnion('type', [
  TheoryQuizExercise,
  SqlQueryExercise,
  PythonFunctionExercise,
  JavascriptFunctionExercise,
  FillInBlanksExercise,
  PredictOutputExercise,
]);
export type Exercise = z.infer<typeof Exercise>;

export const ExerciseFile = z
  .object({
    exercises: z.array(Exercise).min(1),
  })
  .strict();
export type ExerciseFile = z.infer<typeof ExerciseFile>;

export const isInteractiveExercise = (
  exercise: Exercise,
): exercise is SqlQueryExercise | PythonFunctionExercise | JavascriptFunctionExercise =>
  exercise.type === 'sql-query' ||
  exercise.type === 'python-function' ||
  exercise.type === 'javascript-function';
