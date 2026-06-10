import { z } from 'zod';

import { SLUG_PATTERN } from './topic.schema';

export const InterviewStage = z.enum(['hr', 'tech', 'system-design']);
export type InterviewStage = z.infer<typeof InterviewStage>;

export const InterviewCategory = z.string().regex(SLUG_PATTERN);
export type InterviewCategory = z.infer<typeof InterviewCategory>;

export const InterviewQuestionMeta = z
  .object({
    id: z.number().int().positive(),
    title: z.string().min(3),
    titleEn: z.string().optional(),
    category: InterviewCategory,
    categoryLabel: z.string().min(1),
    stage: InterviewStage,
    stageLabel: z.string().min(1),
    exerciseCount: z.number().int().nonnegative().default(0),
    path: z.string().regex(/^[a-z][a-z0-9-]*\/\d+\.ru\.mdx$/),
  })
  .strict();
export type InterviewQuestionMeta = z.infer<typeof InterviewQuestionMeta>;

export const InterviewIndex = z.array(InterviewQuestionMeta);
export type InterviewIndex = z.infer<typeof InterviewIndex>;

export const parseInterviewIndex = (raw: unknown): InterviewQuestionMeta[] =>
  InterviewIndex.parse(raw);

export const InterviewExerciseMeta = z
  .object({
    exerciseId: z.string().min(1),
    qid: z.number().int().positive(),
    category: InterviewCategory,
    categoryLabel: z.string().min(1),
    stage: InterviewStage,
    stageLabel: z.string().min(1),
    type: z.string().min(1),
    difficulty: z.number().int().min(1).max(5),
    path: z.string().regex(/^[a-z][a-z0-9-]*\/\d+\.exercises\.json$/),
  })
  .strict();
export type InterviewExerciseMeta = z.infer<typeof InterviewExerciseMeta>;

export const InterviewExercisesIndex = z.array(InterviewExerciseMeta);
export type InterviewExercisesIndex = z.infer<typeof InterviewExercisesIndex>;

export const parseInterviewExercisesIndex = (raw: unknown): InterviewExerciseMeta[] =>
  InterviewExercisesIndex.parse(raw);
