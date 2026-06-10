import { z } from 'zod';

export const InterviewStage = z.enum(['hr', 'tech', 'system-design']);
export type InterviewStage = z.infer<typeof InterviewStage>;

export const InterviewCategory = z.enum([
  'python',
  'oop',
  'async',
  'databases',
  'algorithms',
  'architecture',
  'testing',
  'django',
  'docker',
  'git',
  'http-api',
  'tools-devops-linux',
  'development-processes',
]);
export type InterviewCategory = z.infer<typeof InterviewCategory>;

export const InterviewQuestionMeta = z
  .object({
    id: z.number().int().positive(),
    title: z.string().min(3),
    category: InterviewCategory,
    categoryLabel: z.string().min(1),
    stage: InterviewStage,
    stageLabel: z.string().min(1),
    path: z.string().regex(/^[a-z][a-z0-9-]*\/\d+\.ru\.mdx$/),
  })
  .strict();
export type InterviewQuestionMeta = z.infer<typeof InterviewQuestionMeta>;

export const InterviewIndex = z.array(InterviewQuestionMeta);
export type InterviewIndex = z.infer<typeof InterviewIndex>;

export const parseInterviewIndex = (raw: unknown): InterviewQuestionMeta[] =>
  InterviewIndex.parse(raw);
