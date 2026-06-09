import { z } from 'zod';

import { TAG_PATTERN, TopicDifficulty, TopicLanguage, TopicRuntime } from './topic.schema';

export const SubmissionStatus = z.enum(['pending', 'approved', 'rejected', 'materialized']);
export type SubmissionStatus = z.infer<typeof SubmissionStatus>;

export const SubmissionSource = z.enum(['in-app', 'github-pr']);
export type SubmissionSource = z.infer<typeof SubmissionSource>;

export const CreateSubmissionInput = z
  .object({
    title: z.string().min(5).max(80),
    outline: z.string().min(20).max(2000),
    suggestedRuntime: TopicRuntime,
    suggestedDifficulty: TopicDifficulty,
    suggestedLanguage: TopicLanguage,
    estimatedHours: z.number().min(0.25).max(200),
    tags: z.array(z.string().regex(TAG_PATTERN)).min(1).max(8),
    sources: z.array(z.string().url()).max(20).default([]),
    contactEmail: z.string().email().optional(),
    notes: z.string().max(1000).optional(),
  })
  .strict();
export type CreateSubmissionInput = z.infer<typeof CreateSubmissionInput>;

export const ReviewSubmissionInput = z
  .object({
    decision: z.enum(['approve', 'reject']),
    reviewerNote: z.string().max(2000).optional(),
  })
  .strict();
export type ReviewSubmissionInput = z.infer<typeof ReviewSubmissionInput>;

export const Submission = z
  .object({
    id: z.string().uuid(),
    status: SubmissionStatus,
    source: SubmissionSource,
    createdAt: z.string().datetime(),
    reviewedAt: z.string().datetime().optional(),
    reviewerNote: z.string().optional(),
    payload: CreateSubmissionInput,
  })
  .strict();
export type Submission = z.infer<typeof Submission>;
