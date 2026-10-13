import { z } from 'zod';

import { SLUG_PATTERN } from './topic.schema';

const ExerciseId = z.string().regex(/^[a-z0-9-]+$/);
const Difficulty = z.number().int().min(1).max(5);

const Name = z.string().min(1).max(40);
const Text = z.string().min(1).max(200);

export const DesignerFieldType = z.enum(['string', 'number', 'enum', 'ref', 'datetime']);
export type DesignerFieldType = z.infer<typeof DesignerFieldType>;

export const DesignerField = z
  .object({
    name: Name,
    type: DesignerFieldType,
    ref: Name.optional(),
    enumValues: z.array(Name).min(1).max(8).optional(),
  })
  .strict()
  .superRefine((field, ctx) => {
    if (field.type === 'enum' && !field.enumValues) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['enumValues'],
        message: 'enum needs values',
      });
    }
    if (field.type !== 'enum' && field.enumValues) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['enumValues'],
        message: 'enum values only for enum',
      });
    }
    if (field.type === 'ref' && !field.ref) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ref'], message: 'ref needs a catalog' });
    }
    if (field.type !== 'ref' && field.ref) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['ref'], message: 'ref only for ref' });
    }
  });
export type DesignerField = z.infer<typeof DesignerField>;

export const DesignerDimension = z
  .object({
    name: Name,
    catalog: Name,
  })
  .strict();
export type DesignerDimension = z.infer<typeof DesignerDimension>;

export const DesignerMovement = z
  .object({
    register: Name,
    direction: z.enum(['in', 'out']),
    qtyField: Name,
    dimensions: z
      .array(
        z
          .object({
            dimension: Name,
            field: Name,
          })
          .strict(),
      )
      .min(1)
      .max(4),
  })
  .strict();
export type DesignerMovement = z.infer<typeof DesignerMovement>;

const GuardMessage = z.object({ message: Text }).strict();

export const DesignerGuard = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('equals'),
      field: Name,
      value: z.string().min(1).max(80),
    })
    .merge(GuardMessage),
  z
    .object({
      kind: z.literal('probe-count'),
      standardField: Name,
      countField: Name,
      rules: z
        .array(
          z
            .object({
              standard: Name,
              count: z.number().int().positive(),
            })
            .strict(),
        )
        .min(1)
        .max(6),
    })
    .merge(GuardMessage),
  z
    .object({
      kind: z.literal('linked-status'),
      linkField: Name,
      document: Name,
      keyField: Name,
      statusField: Name,
      value: z.string().min(1).max(80),
    })
    .merge(GuardMessage),
  z
    .object({
      kind: z.literal('linked-min-minutes'),
      linkField: Name,
      document: Name,
      keyField: Name,
      timeField: Name,
      nowField: Name,
      minutes: z.number().int().positive().max(10080),
    })
    .merge(GuardMessage),
  z
    .object({
      kind: z.literal('linked-max-minutes'),
      linkField: Name,
      document: Name,
      keyField: Name,
      timeField: Name,
      nowField: Name,
      minutes: z.number().int().positive().max(10080),
    })
    .merge(GuardMessage),
]);
export type DesignerGuard = z.infer<typeof DesignerGuard>;

export const DesignerCatalogMeta = z
  .object({
    name: Name,
    fields: z.array(DesignerField).max(16),
  })
  .strict();
export type DesignerCatalogMeta = z.infer<typeof DesignerCatalogMeta>;

export const DesignerDocumentMeta = z
  .object({
    name: Name,
    fields: z.array(DesignerField).max(16),
    movements: z.array(DesignerMovement).max(4).default([]),
    guards: z.array(DesignerGuard).max(6).default([]),
  })
  .strict();
export type DesignerDocumentMeta = z.infer<typeof DesignerDocumentMeta>;

export const DesignerRegisterMeta = z
  .object({
    name: Name,
    dimensions: z.array(DesignerDimension).max(4),
  })
  .strict();
export type DesignerRegisterMeta = z.infer<typeof DesignerRegisterMeta>;

export const DesignerValue = z.union([z.string().min(1).max(80), z.number().finite()]);
export type DesignerValue = z.infer<typeof DesignerValue>;

export const DesignerSeedItem = z
  .object({
    catalog: Name,
    name: z.string().min(1).max(80),
    values: z.record(z.string(), DesignerValue).default({}),
  })
  .strict();

export const DesignerSeedDoc = z
  .object({
    document: Name,
    posted: z.boolean().default(false),
    values: z.record(z.string(), DesignerValue).default({}),
  })
  .strict();

export const DesignerSeed = z
  .object({
    today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    catalogs: z.array(DesignerCatalogMeta).max(12).default([]),
    documents: z.array(DesignerDocumentMeta).max(12).default([]),
    registers: z.array(DesignerRegisterMeta).max(4).default([]),
    items: z.array(DesignerSeedItem).max(40).default([]),
    docs: z.array(DesignerSeedDoc).max(20).default([]),
  })
  .strict();
export type DesignerSeed = z.infer<typeof DesignerSeed>;

export const DesignerScreen = z.enum(['designer', 'enterprise', 'report']);
export type DesignerScreen = z.infer<typeof DesignerScreen>;

export const DESIGNER_FOCI = [
  'mode-designer',
  'mode-enterprise',
  'mode-report',
  'add-catalog',
  'add-document',
  'add-register',
  'meta-tree',
  'add-field',
  'add-movement',
  'add-guard',
  'object-list',
  'doc-form',
  'post',
] as const;
export const DesignerFocus = z.enum(DESIGNER_FOCI);
export type DesignerFocus = z.infer<typeof DesignerFocus>;

export const DesignerCommand = z.discriminatedUnion('op', [
  z.object({ op: z.literal('open-mode'), mode: DesignerScreen }).strict(),
  z.object({ op: z.literal('add-catalog'), name: Name }).strict(),
  z.object({ op: z.literal('add-document'), name: Name }).strict(),
  z.object({ op: z.literal('add-register'), name: Name }).strict(),
  z
    .object({
      op: z.literal('add-dimension'),
      register: Name,
      name: Name,
      catalog: Name,
    })
    .strict(),
  z
    .object({
      op: z.literal('add-field'),
      object: Name,
      name: Name,
      type: DesignerFieldType,
      ref: Name.optional(),
      enumValues: z.array(Name).min(1).max(8).optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal('add-movement'),
      document: Name,
      register: Name,
      direction: z.enum(['in', 'out']),
      qtyField: Name,
      dimensions: DesignerMovement.shape.dimensions,
    })
    .strict(),
  z
    .object({
      op: z.literal('add-guard'),
      document: Name,
      guard: DesignerGuard,
    })
    .strict(),
  z.object({ op: z.literal('open-object'), name: Name }).strict(),
  z.object({ op: z.literal('open-new'), object: Name }).strict(),
  z
    .object({
      op: z.literal('set-value'),
      field: Name,
      value: DesignerValue,
    })
    .strict(),
  z.object({ op: z.literal('save') }).strict(),
  z.object({ op: z.literal('post') }).strict(),
  z.object({ op: z.literal('close') }).strict(),
]);
export type DesignerCommand = z.infer<typeof DesignerCommand>;

const DesignerModeAssertion = z
  .object({ kind: z.literal('mode'), equals: DesignerScreen })
  .strict();
const DesignerListAssertion = z.object({ kind: z.literal('list'), object: Name }).strict();
const DesignerFormAssertion = z
  .object({
    kind: z.literal('form'),
    open: z.boolean(),
    object: Name.optional(),
  })
  .strict();
const DesignerHasCatalog = z.object({ kind: z.literal('has-catalog'), name: Name }).strict();
const DesignerHasDocument = z.object({ kind: z.literal('has-document'), name: Name }).strict();
const DesignerHasRegister = z.object({ kind: z.literal('has-register'), name: Name }).strict();
const DesignerHasField = z
  .object({
    kind: z.literal('has-field'),
    object: Name,
    name: Name,
    type: DesignerFieldType.optional(),
  })
  .strict();
const DesignerHasDimension = z
  .object({
    kind: z.literal('has-dimension'),
    register: Name,
    name: Name,
  })
  .strict();
const DesignerHasMovement = z
  .object({
    kind: z.literal('has-movement'),
    document: Name,
    register: Name,
    direction: z.enum(['in', 'out']),
  })
  .strict();
const DesignerHasGuard = z
  .object({
    kind: z.literal('has-guard'),
    document: Name,
    guard: z.enum([
      'equals',
      'probe-count',
      'linked-status',
      'linked-min-minutes',
      'linked-max-minutes',
    ]),
    minutes: z.number().int().positive().optional(),
    rules: z
      .array(
        z
          .object({
            standard: Name,
            count: z.number().int().positive(),
          })
          .strict(),
      )
      .min(1)
      .optional(),
  })
  .strict();
const DesignerItemAssertion = z
  .object({
    kind: z.literal('item'),
    catalog: Name,
    name: z.string().min(1).max(80),
    values: z.record(z.string(), DesignerValue).optional(),
  })
  .strict();
const DesignerPostedAssertion = z
  .object({
    kind: z.literal('posted'),
    document: Name,
    values: z.record(z.string(), DesignerValue),
  })
  .strict();
const DesignerNotPostedAssertion = z
  .object({ kind: z.literal('not-posted'), document: Name })
  .strict();
const DesignerBalanceAssertion = z
  .object({
    kind: z.literal('balance'),
    register: Name,
    dims: z
      .array(
        z
          .object({
            name: Name,
            value: z.string().min(1).max(80),
          })
          .strict(),
      )
      .min(1)
      .max(4),
    qty: z.number().nonnegative(),
  })
  .strict();

export const DesignerGoal = z.discriminatedUnion('kind', [
  DesignerHasCatalog,
  DesignerHasDocument,
  DesignerHasRegister,
  DesignerHasField,
  DesignerHasDimension,
  DesignerHasMovement,
  DesignerHasGuard,
  DesignerItemAssertion,
  DesignerPostedAssertion,
  DesignerNotPostedAssertion,
  DesignerBalanceAssertion,
]);
export type DesignerGoal = z.infer<typeof DesignerGoal>;

export const DesignerStepExpect = z.discriminatedUnion('kind', [
  DesignerModeAssertion,
  DesignerListAssertion,
  DesignerFormAssertion,
  DesignerHasCatalog,
  DesignerHasDocument,
  DesignerHasRegister,
  DesignerHasField,
  DesignerHasDimension,
  DesignerHasMovement,
  DesignerHasGuard,
  DesignerItemAssertion,
  DesignerPostedAssertion,
  DesignerNotPostedAssertion,
  DesignerBalanceAssertion,
]);
export type DesignerStepExpect = z.infer<typeof DesignerStepExpect>;

export const DesignerStep = z
  .object({
    id: ExerciseId,
    title: z.string().min(1).max(160),
    coach: z.string().min(1).max(600),
    focus: DesignerFocus.optional(),
    expect: z.array(DesignerStepExpect).min(1).max(8),
  })
  .strict();
export type DesignerStep = z.infer<typeof DesignerStep>;

export const DesignerGradeMode = z.enum(['hybrid', 'steps', 'snapshot']);
export type DesignerGradeMode = z.infer<typeof DesignerGradeMode>;

const Base = z.object({
  id: ExerciseId,
  concept: z.string().regex(SLUG_PATTERN),
  difficulty: Difficulty,
  prompt: z.string().min(5),
  hints: z.array(z.string()).optional(),
});

export const DesignerVariant = z
  .object({
    prompt: z.string().min(5).optional(),
    mode: DesignerGradeMode.optional(),
    seed: DesignerSeed.optional(),
    steps: z.array(DesignerStep).min(1).optional(),
    goal: z.array(DesignerGoal).min(1).optional(),
    solution: z.array(DesignerCommand).min(1).optional(),
  })
  .strict();
export type DesignerVariant = z.infer<typeof DesignerVariant>;

export const DesignerExercise = Base.extend({
  type: z.literal('onec-designer'),
  mode: DesignerGradeMode,
  seed: DesignerSeed,
  steps: z.array(DesignerStep).min(1).max(24),
  goal: z.array(DesignerGoal).min(1).max(16),
  solution: z.array(DesignerCommand).min(1),
  variants: z.array(DesignerVariant).min(1).optional(),
});
export type DesignerExercise = z.infer<typeof DesignerExercise>;
