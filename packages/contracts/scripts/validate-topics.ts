import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { parse as parseYaml } from 'yaml';

import { ExerciseFile } from '../src/exercise.schema';
import { TopicManifest } from '../src/topic.schema';
import { ContractValidationError, TopicReferenceError } from '../src/errors';

const ROOT = resolve(process.cwd(), '..', '..');
const TOPICS_DIR = join(ROOT, 'topics');

const formatIssues = (
  issues: ReadonlyArray<{ path: ReadonlyArray<string | number>; message: string }>,
): string => issues.map((i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n');

const validateTopic = async (slug: string): Promise<void> => {
  const topicDir = join(TOPICS_DIR, slug);
  const manifestPath = join(topicDir, 'manifest.json');

  if (!existsSync(manifestPath)) {
    throw new TopicReferenceError(slug, 'manifest.json');
  }

  const manifestRaw = JSON.parse(await readFile(manifestPath, 'utf-8'));
  const manifestResult = TopicManifest.safeParse(manifestRaw);
  if (!manifestResult.success) {
    throw new ContractValidationError('manifest', manifestPath, manifestResult.error.issues);
  }
  const manifest = manifestResult.data;

  if (manifest.slug !== slug) {
    throw new TopicReferenceError(slug, `manifest.slug "${manifest.slug}" does not match folder name`);
  }

  for (const concept of manifest.concepts) {
    for (const theoryFile of concept.theoryFiles) {
      const path = join(topicDir, theoryFile);
      if (!existsSync(path)) {
        throw new TopicReferenceError(slug, `theory file ${theoryFile} missing`);
      }
    }
    for (const exerciseFile of concept.exerciseFiles) {
      const path = join(topicDir, exerciseFile);
      if (!existsSync(path)) {
        throw new TopicReferenceError(slug, `exercise file ${exerciseFile} missing`);
      }
      const exerciseRaw = parseYaml(await readFile(path, 'utf-8'));
      const exerciseResult = ExerciseFile.safeParse(exerciseRaw);
      if (!exerciseResult.success) {
        throw new ContractValidationError('exercise', path, exerciseResult.error.issues);
      }
      for (const exercise of exerciseResult.data.exercises) {
        if (exercise.concept !== concept.id) {
          throw new TopicReferenceError(
            slug,
            `Exercise ${exercise.id} claims concept "${exercise.concept}" but lives in concept "${concept.id}" file`,
          );
        }
      }
    }
  }
};

const main = async (): Promise<number> => {
  if (!existsSync(TOPICS_DIR)) {
    console.log('No topics/ directory yet. Nothing to validate.');
    return 0;
  }
  const entries = await readdir(TOPICS_DIR, { withFileTypes: true });
  const topicSlugs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  if (topicSlugs.length === 0) {
    console.log('No topics found.');
    return 0;
  }

  let failures = 0;
  for (const slug of topicSlugs) {
    try {
      await validateTopic(slug);
      console.log(`✓ ${slug}`);
    } catch (error) {
      failures += 1;
      if (error instanceof ContractValidationError) {
        console.error(`✗ ${slug} — ${error.resource} invalid`);
        console.error(formatIssues(error.issues));
      } else if (error instanceof TopicReferenceError) {
        console.error(`✗ ${slug} — ${error.missingReference}`);
      } else {
        console.error(`✗ ${slug} — unexpected error`);
        console.error(error);
      }
    }
  }

  console.log(`\n${topicSlugs.length - failures}/${topicSlugs.length} topics valid.`);
  return failures > 0 ? 1 : 0;
};

main().then((code) => process.exit(code));
