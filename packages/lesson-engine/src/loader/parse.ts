import { parse as parseYaml } from 'yaml';

import { ExerciseFile, TopicManifest, type Exercise } from '@dotlearn/contracts';

import { TopicLoadError } from './source';

export const parseManifest = (slug: string, raw: unknown): TopicManifest => {
  const result = TopicManifest.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new TopicLoadError(slug, 'manifest', `validation failed — ${issues}`);
  }
  if (result.data.slug !== slug) {
    throw new TopicLoadError(
      slug,
      'manifest',
      `manifest.slug "${result.data.slug}" does not match folder name`,
    );
  }
  return result.data;
};

export const parseExerciseFile = (slug: string, filename: string, raw: string): Exercise[] => {
  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (error) {
    throw new TopicLoadError(
      slug,
      filename,
      `invalid YAML: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const result = ExerciseFile.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new TopicLoadError(slug, filename, `validation failed — ${issues}`);
  }
  return result.data.exercises;
};
