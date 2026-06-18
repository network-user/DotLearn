import { z } from 'zod';

import {
  isHttpUrl,
  TAG_PATTERN,
  TopicDifficulty,
  TopicLanguage,
  TopicRuntime,
} from './topic.schema';

export const SubmissionStatus = z.enum(['pending', 'approved', 'rejected', 'materialized']);
export type SubmissionStatus = z.infer<typeof SubmissionStatus>;

export const SubmissionSource = z.enum(['in-app', 'github-pr']);
export type SubmissionSource = z.infer<typeof SubmissionSource>;

const CreateSubmissionShape = z
  .object({
    title: z.string().min(5).max(80),
    outline: z.string().min(20).max(2000),
    suggestedRuntime: TopicRuntime,
    suggestedDifficulty: TopicDifficulty,
    suggestedLanguages: z.array(TopicLanguage).min(1),
    suggestedPrimaryLanguage: TopicLanguage,
    estimatedHours: z.number().min(0.25).max(200),
    tags: z.array(z.string().regex(TAG_PATTERN)).min(1).max(8),
    sources: z
      .array(
        z
          .string()
          .url()
          .max(2048)
          .refine(isHttpUrl, { message: 'source url must use the http(s) scheme' }),
      )
      .max(20)
      .default([]),
    contactEmail: z.string().email().optional(),
    notes: z.string().max(1000).optional(),
  })
  .strict();

const checkLanguagePair = (
  input: { suggestedLanguages: ('en' | 'ru')[]; suggestedPrimaryLanguage: 'en' | 'ru' },
  ctx: z.RefinementCtx,
): void => {
  const unique = new Set(input.suggestedLanguages);
  if (unique.size !== input.suggestedLanguages.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['suggestedLanguages'],
      message: 'suggestedLanguages must not contain duplicates',
    });
  }
  if (!unique.has(input.suggestedPrimaryLanguage)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['suggestedPrimaryLanguage'],
      message: 'suggestedPrimaryLanguage must be listed in suggestedLanguages',
    });
  }
};

export const CreateSubmissionInput = CreateSubmissionShape.superRefine(checkLanguagePair);
export type CreateSubmissionInput = z.infer<typeof CreateSubmissionInput>;

export const ReviewSubmissionInput = z
  .object({
    decision: z.enum(['approve', 'reject']),
    reviewerNote: z.string().max(2000).optional(),
  })
  .strict();
export type ReviewSubmissionInput = z.infer<typeof ReviewSubmissionInput>;

export const MarkMaterializedInput = z
  .object({
    materializedSlug: z
      .string()
      .regex(/^[a-z][a-z0-9-]*[a-z0-9]$/)
      .optional(),
    reviewerNote: z.string().max(2000).optional(),
  })
  .strict();
export type MarkMaterializedInput = z.infer<typeof MarkMaterializedInput>;

export const Submission = z
  .object({
    id: z.string().uuid(),
    status: SubmissionStatus,
    source: SubmissionSource,
    createdAt: z.string().datetime(),
    reviewedAt: z.string().datetime().optional(),
    reviewerNote: z.string().optional(),
    materializedSlug: z.string().optional(),
    payload: CreateSubmissionInput,
  })
  .strict();
export type Submission = z.infer<typeof Submission>;

export const SubmissionPublicPayload = CreateSubmissionShape.omit({
  contactEmail: true,
  notes: true,
}).superRefine(checkLanguagePair);
export type SubmissionPublicPayload = z.infer<typeof SubmissionPublicPayload>;

export const SubmissionPublic = z
  .object({
    id: z.string().uuid(),
    status: SubmissionStatus,
    source: SubmissionSource,
    createdAt: z.string().datetime(),
    reviewedAt: z.string().datetime().optional(),
    materializedSlug: z.string().optional(),
    payload: SubmissionPublicPayload,
  })
  .strict();
export type SubmissionPublic = z.infer<typeof SubmissionPublic>;

export const SubmissionSearchResult = z.object({
  hits: z.array(SubmissionPublic),
  total: z.number().int().min(0),
});
export type SubmissionSearchResult = z.infer<typeof SubmissionSearchResult>;

export const SubmissionSuggestion = z.object({
  id: z.string().uuid(),
  title: z.string(),
});
export type SubmissionSuggestion = z.infer<typeof SubmissionSuggestion>;
