import { z } from 'zod';

export const SLUG_PATTERN = /^[a-z][a-z0-9-]*[a-z0-9]$/;
export const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
export const TAG_PATTERN = /^[a-z][a-z0-9-]*$/;
export const THEORY_FILE_PATTERN = /^theory\/\d{2}-[a-z0-9-]+\.mdx$/;
export const EXERCISE_FILE_PATTERN = /^exercises\/\d{2}-[a-z0-9-]+\.yaml$/;

export const TopicLanguage = z.enum(['en', 'ru']);
export type TopicLanguage = z.infer<typeof TopicLanguage>;

export const TopicDifficulty = z.enum(['beginner', 'intermediate', 'advanced']);
export type TopicDifficulty = z.infer<typeof TopicDifficulty>;

export const TopicRuntime = z.enum(['sql.js', 'pyodide', 'javascript', 'none']);
export type TopicRuntime = z.infer<typeof TopicRuntime>;

export const TopicLicense = z.enum(['MIT', 'Apache-2.0', 'CC-BY-4.0', 'CC-BY-SA-4.0']);
export type TopicLicense = z.infer<typeof TopicLicense>;

export const TopicAuthor = z.object({
  kind: z.enum(['agent', 'human']),
  name: z.string().min(1),
  model: z.string().optional(),
});
export type TopicAuthor = z.infer<typeof TopicAuthor>;

export const TopicConcept = z.object({
  id: z.string().regex(SLUG_PATTERN),
  title: z.string().min(3),
  estimatedMinutes: z.number().int().min(5).max(240),
  theoryFiles: z.array(z.string().regex(THEORY_FILE_PATTERN)).min(1),
  exerciseFiles: z.array(z.string().regex(EXERCISE_FILE_PATTERN)).min(1),
});
export type TopicConcept = z.infer<typeof TopicConcept>;

export const TopicManifest = z
  .object({
    slug: z.string().regex(SLUG_PATTERN).min(3).max(60),
    title: z.string().min(3).max(80),
    version: z.string().regex(SEMVER_PATTERN),
    language: TopicLanguage,
    difficulty: TopicDifficulty,
    estimatedHours: z.number().min(0.25).max(200),
    runtime: TopicRuntime,
    prerequisites: z.array(z.string().regex(SLUG_PATTERN)).default([]),
    tags: z.array(z.string().regex(TAG_PATTERN)).min(1).max(8),
    author: TopicAuthor,
    concepts: z.array(TopicConcept).min(1),
    license: TopicLicense,
  })
  .strict()
  .superRefine((manifest, ctx) => {
    const folderInferredFromSlug = manifest.slug;
    const expectedTotalMinutes = manifest.estimatedHours * 60;
    const actualMinutes = manifest.concepts.reduce((sum, c) => sum + c.estimatedMinutes, 0);
    const drift = Math.abs(actualMinutes - expectedTotalMinutes) / expectedTotalMinutes;
    if (drift > 0.25) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['estimatedHours'],
        message: `estimatedHours (${manifest.estimatedHours}h = ${expectedTotalMinutes}min) drifts more than 25% from sum of concepts (${actualMinutes}min)`,
      });
    }
    const conceptIds = new Set<string>();
    for (const concept of manifest.concepts) {
      if (conceptIds.has(concept.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['concepts'],
          message: `Duplicate concept id "${concept.id}" within topic "${folderInferredFromSlug}"`,
        });
      }
      conceptIds.add(concept.id);
    }
  });

export type TopicManifest = z.infer<typeof TopicManifest>;
