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

export const TheoryQuizVariant = z.object({
  prompt: z.string().min(5).optional(),
  choices: z.array(TheoryQuizChoice).min(2),
  correct: z.array(z.string()).min(1),
  explanation: z.string().optional(),
});
export type TheoryQuizVariant = z.infer<typeof TheoryQuizVariant>;

export const TheoryQuizExercise = BaseExercise.extend({
  type: z.literal('theory-quiz'),
  choices: z.array(TheoryQuizChoice).min(2),
  correct: z.array(z.string()).min(1),
  explanation: z.string().optional(),
  variants: z.array(TheoryQuizVariant).min(1).optional(),
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

export const SqlQueryVariant = z.object({
  prompt: z.string().min(5).optional(),
  fixture: z.string().min(1).optional(),
  expected: z.discriminatedUnion('kind', [ResultSetExpected, ScalarExpected]),
  solution: z.string().min(1),
});
export type SqlQueryVariant = z.infer<typeof SqlQueryVariant>;

export const SqlQueryExercise = BaseExercise.extend({
  type: z.literal('sql-query'),
  fixture: z.string().min(1),
  expected: z.discriminatedUnion('kind', [ResultSetExpected, ScalarExpected]),
  solution: z.string().min(1),
  variants: z.array(SqlQueryVariant).min(1).optional(),
});
export type SqlQueryExercise = z.infer<typeof SqlQueryExercise>;

export const FunctionCase = z.object({
  call: z.string().min(1),
  expect: z.unknown().optional(),
  expect_approx: z.number().optional(),
});

export const FunctionVariant = z.object({
  prompt: z.string().min(5).optional(),
  starter: z.string().min(1).optional(),
  cases: z.array(FunctionCase).min(1),
  solution: z.string().min(1),
});
export type FunctionVariant = z.infer<typeof FunctionVariant>;

export const PythonFunctionExercise = BaseExercise.extend({
  type: z.literal('python-function'),
  starter: z.string().min(1),
  cases: z.array(FunctionCase).min(1),
  solution: z.string().min(1),
  variants: z.array(FunctionVariant).min(1).optional(),
});
export type PythonFunctionExercise = z.infer<typeof PythonFunctionExercise>;

export const JavascriptFunctionExercise = BaseExercise.extend({
  type: z.literal('javascript-function'),
  starter: z.string().min(1),
  cases: z.array(FunctionCase).min(1),
  solution: z.string().min(1),
  variants: z.array(FunctionVariant).min(1).optional(),
});
export type JavascriptFunctionExercise = z.infer<typeof JavascriptFunctionExercise>;

const NESTED_QUANTIFIER = /\([^)]*[+*{][^)]*\)\s*[+*{]/;

export const MAX_ACCEPT_REGEX_LENGTH = 200;

// A topic-supplied accept_regex is compiled with new RegExp() in the learner's browser. Bound
// its length and reject the canonical catastrophic-backtracking shape (a quantifier applied to a
// group that itself contains a quantifier, e.g. "(a+)+") so a malicious/careless topic cannot
// ship a ReDoS pattern that freezes the visitor's tab. pnpm validate enforces this at authoring.
export const isBoundedUserRegex = (pattern: string): boolean =>
  pattern.length <= MAX_ACCEPT_REGEX_LENGTH && !NESTED_QUANTIFIER.test(pattern);

const BlankSpec = z.object({
  accept: z.array(z.string()).optional(),
  accept_regex: z
    .string()
    .max(MAX_ACCEPT_REGEX_LENGTH)
    .refine((pattern) => !NESTED_QUANTIFIER.test(pattern), {
      message: 'accept_regex must not contain nested quantifiers (ReDoS risk)',
    })
    .optional(),
});

export const FillInBlanksVariant = z.object({
  prompt: z.string().min(5).optional(),
  template: z.string().min(1),
  blanks: z.record(z.string(), BlankSpec),
});
export type FillInBlanksVariant = z.infer<typeof FillInBlanksVariant>;

export const FillInBlanksExercise = BaseExercise.extend({
  type: z.literal('fill-in-blanks'),
  template: z.string().min(1),
  blanks: z.record(z.string(), BlankSpec),
  variants: z.array(FillInBlanksVariant).min(1).optional(),
});
export type FillInBlanksExercise = z.infer<typeof FillInBlanksExercise>;

export const PredictOutputVariant = z.object({
  prompt: z.string().min(5).optional(),
  snippet: z.string().min(1),
  fixture: z.string().optional(),
  expected: z.discriminatedUnion('kind', [ResultSetExpected, ScalarExpected, StdoutExpected]),
});
export type PredictOutputVariant = z.infer<typeof PredictOutputVariant>;

export const PredictOutputExercise = BaseExercise.extend({
  type: z.literal('predict-output'),
  snippet: z.string().min(1),
  fixture: z.string().optional(),
  expected: z.discriminatedUnion('kind', [ResultSetExpected, ScalarExpected, StdoutExpected]),
  variants: z.array(PredictOutputVariant).min(1).optional(),
});
export type PredictOutputExercise = z.infer<typeof PredictOutputExercise>;

export const GitGoalAssertion = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('commit-count'),
    ref: z.string().min(1).default('HEAD'),
    equals: z.number().int().min(0),
  }),
  z.object({
    kind: z.literal('file-content'),
    path: z.string().min(1),
    equals: z.string(),
    where: z.enum(['worktree', 'head']).default('worktree'),
  }),
  z.object({
    kind: z.literal('file-tracked'),
    path: z.string().min(1),
  }),
  z.object({
    kind: z.literal('file-absent'),
    path: z.string().min(1),
    where: z.enum(['worktree', 'head']).default('worktree'),
  }),
  z.object({
    kind: z.literal('staged'),
    path: z.string().min(1),
  }),
  z.object({
    kind: z.literal('branch-exists'),
    name: z.string().min(1),
  }),
  z.object({
    kind: z.literal('branch-absent'),
    name: z.string().min(1),
  }),
  z.object({
    kind: z.literal('head-on-branch'),
    name: z.string().min(1),
  }),
  z.object({
    kind: z.literal('head-detached'),
  }),
  z.object({
    kind: z.literal('head-at'),
    ref: z.string().min(1),
  }),
  z.object({
    kind: z.literal('clean-tree'),
  }),
  z.object({
    kind: z.literal('merged'),
    branch: z.string().min(1),
    into: z.string().min(1).default('HEAD'),
  }),
  z.object({
    kind: z.literal('commit-message'),
    ref: z.string().min(1).default('HEAD'),
    index: z.number().int().min(0).default(0),
    contains: z.string().min(1),
  }),
  z.object({
    kind: z.literal('tag-exists'),
    name: z.string().min(1),
  }),
]);
export type GitGoalAssertion = z.infer<typeof GitGoalAssertion>;

export const GitChallengeSetup = z.object({
  files: z.record(z.string(), z.string()).optional(),
  commands: z.array(z.string()).optional(),
});
export type GitChallengeSetup = z.infer<typeof GitChallengeSetup>;

export const GitChallengeVariant = z.object({
  prompt: z.string().min(5).optional(),
  setup: GitChallengeSetup.optional(),
  goal: z.array(GitGoalAssertion).min(1).optional(),
  solution: z.array(z.string().min(1)).min(1).optional(),
});
export type GitChallengeVariant = z.infer<typeof GitChallengeVariant>;

export const GitChallengeExercise = BaseExercise.extend({
  type: z.literal('git-challenge'),
  setup: GitChallengeSetup.optional(),
  goal: z.array(GitGoalAssertion).min(1),
  solution: z.array(z.string().min(1)).min(1),
  variants: z.array(GitChallengeVariant).min(1).optional(),
});
export type GitChallengeExercise = z.infer<typeof GitChallengeExercise>;

export const Exercise = z.discriminatedUnion('type', [
  TheoryQuizExercise,
  SqlQueryExercise,
  PythonFunctionExercise,
  JavascriptFunctionExercise,
  FillInBlanksExercise,
  PredictOutputExercise,
  GitChallengeExercise,
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

export const isGitChallenge = (exercise: Exercise): exercise is GitChallengeExercise =>
  exercise.type === 'git-challenge';

export const exerciseVariantCount = (exercise: Exercise): number =>
  1 + (exercise.variants?.length ?? 0);

const stripUndefined = <T extends Record<string, unknown>>(value: T): Partial<T> => {
  const result: Partial<T> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) {
      (result as Record<string, unknown>)[key] = entry;
    }
  }
  return result;
};

export const resolveExerciseVariant = (exercise: Exercise, variantIndex: number): Exercise => {
  const { variants, ...base } = exercise;
  if (variantIndex <= 0 || !variants || variants.length === 0) {
    return base as Exercise;
  }
  const variant = variants[Math.min(variantIndex, variants.length) - 1];
  if (!variant) {
    return base as Exercise;
  }
  return { ...base, ...stripUndefined(variant) } as Exercise;
};
