import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { parseExerciseFile, parseManifest } from './parse';
import {
  TopicLoadError,
  TopicNotFoundError,
  type ConceptBundle,
  type ExerciseFileBundle,
  type TheoryFile,
  type TopicBundle,
  type TopicSource,
} from './source';

export interface NodeTopicSourceOptions {
  topicsDir: string;
}

export const createNodeTopicSource = (options: NodeTopicSourceOptions): TopicSource => {
  const { topicsDir } = options;

  const list = async (): Promise<string[]> => {
    if (!existsSync(topicsDir)) {
      return [];
    }
    const entries = await readdir(topicsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  };

  const load = async (slug: string): Promise<TopicBundle> => {
    const topicDir = join(topicsDir, slug);
    const manifestPath = join(topicDir, 'manifest.json');
    if (!existsSync(manifestPath)) {
      throw new TopicNotFoundError(slug);
    }
    const manifestRaw = JSON.parse(await readFile(manifestPath, 'utf-8')) as unknown;
    const manifest = parseManifest(slug, manifestRaw);

    const concepts: ConceptBundle[] = [];
    for (const concept of manifest.concepts) {
      const theory: TheoryFile[] = [];
      for (const filename of concept.theoryFiles) {
        const path = join(topicDir, filename);
        if (!existsSync(path)) {
          throw new TopicLoadError(slug, filename, 'theory file does not exist on disk');
        }
        theory.push({ filename, source: await readFile(path, 'utf-8') });
      }
      const exercises: ExerciseFileBundle[] = [];
      for (const filename of concept.exerciseFiles) {
        const path = join(topicDir, filename);
        if (!existsSync(path)) {
          throw new TopicLoadError(slug, filename, 'exercise file does not exist on disk');
        }
        const parsed = parseExerciseFile(slug, filename, await readFile(path, 'utf-8'));
        for (const exercise of parsed) {
          if (exercise.concept !== concept.id) {
            throw new TopicLoadError(
              slug,
              filename,
              `exercise ${exercise.id} declares concept "${exercise.concept}" but lives in concept "${concept.id}"`,
            );
          }
        }
        exercises.push({ filename, exercises: parsed });
      }
      concepts.push({ conceptId: concept.id, theory, exercises });
    }

    return { manifest, concepts };
  };

  return { list, load };
};
