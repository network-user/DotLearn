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

export const OnecSection = z.enum(['home', 'catalogs', 'documents', 'reports']);
export type OnecSection = z.infer<typeof OnecSection>;

export const OnecCatalog = z.enum(['counterparties', 'products', 'warehouses']);
export type OnecCatalog = z.infer<typeof OnecCatalog>;

export const OnecList = z.enum([
  'counterparties',
  'products',
  'warehouses',
  'receipts',
  'balances',
]);
export type OnecList = z.infer<typeof OnecList>;

export const ONEC_FOCI = [
  'sections',
  'catalog-nav',
  'counterparty-create',
  'document-nav',
  'receipt-create',
  'receipt-fields',
  'post',
  'report-nav',
] as const;
export const OnecFocus = z.enum(ONEC_FOCI);
export type OnecFocus = z.infer<typeof OnecFocus>;

const OnecNamed = z.object({ name: z.string().min(1).max(120) }).strict();

export const OnecSeed = z
  .object({
    today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    counterparties: z.array(OnecNamed).max(20).default([]),
    products: z.array(OnecNamed).max(20).default([]),
    warehouses: z.array(OnecNamed).max(20).default([]),
  })
  .strict();
export type OnecSeed = z.infer<typeof OnecSeed>;

const OnecLine = z
  .object({
    product: z.string().min(1),
    qty: z.number().positive(),
  })
  .strict();

const OnecSectionAssertion = z.object({ kind: z.literal('section'), equals: OnecSection }).strict();
const OnecListAssertion = z.object({ kind: z.literal('list'), object: OnecList }).strict();
const OnecFormAssertion = z
  .object({ kind: z.literal('form'), equals: z.enum(['receipt', 'none']) })
  .strict();
const OnecCatalogAssertion = z
  .object({ kind: z.literal('catalog-item'), catalog: OnecCatalog, name: z.string().min(1) })
  .strict();
const OnecPostedAssertion = z
  .object({
    kind: z.literal('document-posted'),
    counterparty: z.string().min(1),
    warehouse: z.string().min(1),
    lines: z.array(OnecLine).min(1).max(20),
  })
  .strict();
const OnecBalanceAssertion = z
  .object({
    kind: z.literal('balance'),
    product: z.string().min(1),
    warehouse: z.string().min(1),
    qty: z.number().nonnegative(),
  })
  .strict();

export const OnecStepExpect = z.discriminatedUnion('kind', [
  OnecSectionAssertion,
  OnecListAssertion,
  OnecFormAssertion,
  OnecCatalogAssertion,
  OnecPostedAssertion,
  OnecBalanceAssertion,
]);
export type OnecStepExpect = z.infer<typeof OnecStepExpect>;

export const OnecGoal = z.discriminatedUnion('kind', [
  OnecCatalogAssertion,
  OnecPostedAssertion,
  OnecBalanceAssertion,
]);
export type OnecGoal = z.infer<typeof OnecGoal>;

export const OnecStep = z
  .object({
    id: ExerciseId,
    title: z.string().min(1).max(160),
    coach: z.string().min(1).max(600),
    focus: OnecFocus.optional(),
    expect: z.array(OnecStepExpect).min(1).max(6),
  })
  .strict();
export type OnecStep = z.infer<typeof OnecStep>;

export const OnecCommand = z.discriminatedUnion('op', [
  z.object({ op: z.literal('open-section'), section: OnecSection }).strict(),
  z.object({ op: z.literal('open-list'), object: OnecList }).strict(),
  z
    .object({ op: z.literal('create-catalog'), catalog: OnecCatalog, name: z.string().min(1) })
    .strict(),
  z.object({ op: z.literal('open-new-receipt') }).strict(),
  z.object({ op: z.literal('open-receipt'), id: z.string().min(1) }).strict(),
  z
    .object({
      op: z.literal('set-receipt-field'),
      field: z.enum(['counterparty', 'warehouse']),
      value: z.string().min(1),
    })
    .strict(),
  z
    .object({
      op: z.literal('add-receipt-line'),
      product: z.string().min(1),
      qty: z.number().positive(),
      price: z.number().nonnegative(),
    })
    .strict(),
  z
    .object({ op: z.literal('remove-receipt-line'), index: z.number().int().nonnegative() })
    .strict(),
  z.object({ op: z.literal('save-receipt') }).strict(),
  z.object({ op: z.literal('post-receipt') }).strict(),
  z.object({ op: z.literal('unpost-receipt') }).strict(),
  z.object({ op: z.literal('close-form') }).strict(),
]);
export type OnecCommand = z.infer<typeof OnecCommand>;

export const OnecLabMode = z.enum(['hybrid', 'steps', 'snapshot']);
export type OnecLabMode = z.infer<typeof OnecLabMode>;

export const OnecLabVariant = z
  .object({
    prompt: z.string().min(5).optional(),
    mode: OnecLabMode.optional(),
    seed: OnecSeed.optional(),
    steps: z.array(OnecStep).min(1).optional(),
    goal: z.array(OnecGoal).min(1).optional(),
    solution: z.array(OnecCommand).min(1).optional(),
  })
  .strict();
export type OnecLabVariant = z.infer<typeof OnecLabVariant>;

export const OnecLabExercise = BaseExercise.extend({
  type: z.literal('onec-lab'),
  mode: OnecLabMode,
  seed: OnecSeed,
  steps: z.array(OnecStep).min(1).max(24),
  goal: z.array(OnecGoal).min(1).max(12),
  solution: z.array(OnecCommand).min(1),
  variants: z.array(OnecLabVariant).min(1).optional(),
});
export type OnecLabExercise = z.infer<typeof OnecLabExercise>;

export const Exercise = z.discriminatedUnion('type', [
  TheoryQuizExercise,
  SqlQueryExercise,
  PythonFunctionExercise,
  JavascriptFunctionExercise,
  FillInBlanksExercise,
  PredictOutputExercise,
  GitChallengeExercise,
  OnecLabExercise,
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

export const isOnecLab = (exercise: Exercise): exercise is OnecLabExercise =>
  exercise.type === 'onec-lab';

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
