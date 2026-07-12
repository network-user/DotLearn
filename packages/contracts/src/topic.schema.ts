import { z } from 'zod';

export const SLUG_PATTERN = /^[a-z][a-z0-9-]*[a-z0-9]$/;
export const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
export const TAG_PATTERN = /^[a-z][a-z0-9-]*$/;
export const THEORY_FILE_PATTERN = /^theory\/\d{2}-[a-z0-9-]+\.(en|ru)\.mdx$/;
export const EXERCISE_FILE_PATTERN = /^exercises\/\d{2}-[a-z0-9-]+\.(en|ru)\.yaml$/;

export const TopicLanguage = z.enum(['en', 'ru']);
export type TopicLanguage = z.infer<typeof TopicLanguage>;

export const TopicDifficulty = z.enum(['beginner', 'intermediate', 'advanced']);
export type TopicDifficulty = z.infer<typeof TopicDifficulty>;

export const TopicRuntime = z.enum(['sql.js', 'pyodide', 'javascript', 'git', 'none']);
export type TopicRuntime = z.infer<typeof TopicRuntime>;

export const TopicLicense = z.enum([
  'MIT',
  'Apache-2.0',
  'CC-BY-4.0',
  'CC-BY-SA-4.0',
  'CC-BY-NC-4.0',
]);
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
  titleEn: z.string().min(3).max(100).optional(),
  estimatedMinutes: z.number().int().min(5).max(240),
  theoryFiles: z.array(z.string().regex(THEORY_FILE_PATTERN)).min(1),
  exerciseFiles: z.array(z.string().regex(EXERCISE_FILE_PATTERN)).min(1),
});
export type TopicConcept = z.infer<typeof TopicConcept>;

export const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value);

export const TopicSourceRef = z.object({
  title: z.string().min(1),
  url: z.string().url().refine(isHttpUrl, { message: 'url must use the http(s) scheme' }),
});
export type TopicSourceRef = z.infer<typeof TopicSourceRef>;

const fileLanguage = (filename: string): TopicLanguage | undefined => {
  if (filename.endsWith('.en.mdx') || filename.endsWith('.en.yaml')) return 'en';
  if (filename.endsWith('.ru.mdx') || filename.endsWith('.ru.yaml')) return 'ru';
  return undefined;
};

export const TopicManifestObject = z
  .object({
    slug: z.string().regex(SLUG_PATTERN).min(3).max(60),
    title: z.string().min(3).max(80),
    titleEn: z.string().min(3).max(80).optional(),
    descriptions: z
      .object({
        ru: z.string().min(50).max(200).optional(),
        en: z.string().min(50).max(200).optional(),
      })
      .strict()
      .optional(),
    version: z.string().regex(SEMVER_PATTERN),
    availableLanguages: z.array(TopicLanguage).min(1),
    primaryLanguage: TopicLanguage,
    difficulty: TopicDifficulty,
    estimatedHours: z.number().min(0.25).max(200),
    runtime: TopicRuntime,
    prerequisites: z.array(z.string().regex(SLUG_PATTERN)).default([]),
    relatedTopics: z.array(z.string().regex(SLUG_PATTERN)).optional(),
    tags: z.array(z.string().regex(TAG_PATTERN)).min(1).max(8),
    author: TopicAuthor,
    concepts: z.array(TopicConcept).min(1),
    license: TopicLicense,
    sources: z.array(TopicSourceRef).optional(),
  })
  .strict();
export type TopicManifestObject = z.infer<typeof TopicManifestObject>;

export const TopicManifest = TopicManifestObject.superRefine((manifest, ctx) => {
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
  const uniqueAvailable = new Set(manifest.availableLanguages);
  if (uniqueAvailable.size !== manifest.availableLanguages.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['availableLanguages'],
      message: 'availableLanguages must not contain duplicates',
    });
  }
  if (!uniqueAvailable.has(manifest.primaryLanguage)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['primaryLanguage'],
      message: 'primaryLanguage must be listed in availableLanguages',
    });
  }
  const descriptions = manifest.descriptions ?? {};
  for (const lang of Object.keys(descriptions) as TopicLanguage[]) {
    if (!uniqueAvailable.has(lang)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['descriptions', lang],
        message: `descriptions has key "${lang}" that is not listed in availableLanguages`,
      });
    }
  }
  if (!descriptions[manifest.primaryLanguage]) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['descriptions'],
      message: `descriptions.${manifest.primaryLanguage} is required (primaryLanguage)`,
    });
  }
  if (uniqueAvailable.has('en')) {
    if (!descriptions.en) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['descriptions', 'en'],
        message: 'descriptions.en is required when "en" is in availableLanguages',
      });
    }
    if (!manifest.titleEn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['titleEn'],
        message: 'titleEn is required when "en" is in availableLanguages',
      });
    }
  } else if (manifest.titleEn) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['titleEn'],
      message: 'titleEn is only allowed when "en" is in availableLanguages',
    });
  }
  if (manifest.relatedTopics) {
    const uniqueRelated = new Set(manifest.relatedTopics);
    if (uniqueRelated.size !== manifest.relatedTopics.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['relatedTopics'],
        message: 'relatedTopics must not contain duplicates',
      });
    }
    if (uniqueRelated.has(manifest.slug)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['relatedTopics'],
        message: 'relatedTopics must not reference the topic itself',
      });
    }
    const prerequisites = new Set(manifest.prerequisites);
    for (const related of manifest.relatedTopics) {
      if (prerequisites.has(related)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['relatedTopics'],
          message: `relatedTopics must be distinct from prerequisites ("${related}" is already a prerequisite)`,
        });
      }
    }
  }
  const conceptIds = new Set<string>();
  for (const [index, concept] of manifest.concepts.entries()) {
    if (conceptIds.has(concept.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['concepts', index, 'id'],
        message: `Duplicate concept id "${concept.id}" within topic "${folderInferredFromSlug}"`,
      });
    }
    conceptIds.add(concept.id);
    if (uniqueAvailable.has('en')) {
      if (!concept.titleEn) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['concepts', index, 'titleEn'],
          message: `Concept "${concept.id}" is missing titleEn (required when "en" is in availableLanguages)`,
        });
      }
    } else if (concept.titleEn) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['concepts', index, 'titleEn'],
        message: `Concept "${concept.id}" has titleEn but "en" is not in availableLanguages`,
      });
    }
    for (const lang of manifest.availableLanguages) {
      const hasTheory = concept.theoryFiles.some((file) => fileLanguage(file) === lang);
      const hasExercise = concept.exerciseFiles.some((file) => fileLanguage(file) === lang);
      if (!hasTheory) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['concepts', index, 'theoryFiles'],
          message: `Concept "${concept.id}" has no theory file for language "${lang}"`,
        });
      }
      if (!hasExercise) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['concepts', index, 'exerciseFiles'],
          message: `Concept "${concept.id}" has no exercise file for language "${lang}"`,
        });
      }
    }
  }
});

export type TopicManifest = z.infer<typeof TopicManifest>;

export const languageOfTopicFile = fileLanguage;
