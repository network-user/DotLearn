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

export interface TopicGlobInput {
  manifests: Record<string, unknown>;
  exercises: Record<string, string>;
  theories?: Record<string, string>;
}

interface ParsedGlobs {
  manifests: Map<string, unknown>;
  theories: Map<string, Map<string, string>>;
  exercises: Map<string, Map<string, string>>;
}

const TOPIC_PATH = /\/topics\/([a-z][a-z0-9-]*[a-z0-9])\/(.+)$/;

const extractSlugAndTail = (path: string): { slug: string; tail: string } | undefined => {
  const match = TOPIC_PATH.exec(path);
  if (!match) {
    return undefined;
  }
  return { slug: match[1] as string, tail: match[2] as string };
};

const indexGlobs = (input: TopicGlobInput): ParsedGlobs => {
  const manifests = new Map<string, unknown>();
  const theories = new Map<string, Map<string, string>>();
  const exercises = new Map<string, Map<string, string>>();

  for (const [path, value] of Object.entries(input.manifests)) {
    const matched = extractSlugAndTail(path);
    if (matched && matched.tail === 'manifest.json') {
      manifests.set(matched.slug, value);
    }
  }
  if (input.theories) {
    for (const [path, value] of Object.entries(input.theories)) {
      const matched = extractSlugAndTail(path);
      if (matched && matched.tail.startsWith('theory/')) {
        const bucket = theories.get(matched.slug) ?? new Map<string, string>();
        bucket.set(matched.tail, value);
        theories.set(matched.slug, bucket);
      }
    }
  }
  for (const [path, value] of Object.entries(input.exercises)) {
    const matched = extractSlugAndTail(path);
    if (matched && matched.tail.startsWith('exercises/')) {
      const bucket = exercises.get(matched.slug) ?? new Map<string, string>();
      bucket.set(matched.tail, value);
      exercises.set(matched.slug, bucket);
    }
  }
  return { manifests, theories, exercises };
};

export const createBrowserTopicSource = (input: TopicGlobInput): TopicSource => {
  const indexed = indexGlobs(input);

  const list = async (): Promise<string[]> => [...indexed.manifests.keys()].sort();

  const load = async (slug: string): Promise<TopicBundle> => {
    const rawManifest = indexed.manifests.get(slug);
    if (rawManifest === undefined) {
      throw new TopicNotFoundError(slug);
    }
    const manifest = parseManifest(slug, rawManifest);
    const theoryBucket = indexed.theories.get(slug) ?? new Map<string, string>();
    const exerciseBucket = indexed.exercises.get(slug) ?? new Map<string, string>();

    const concepts: ConceptBundle[] = manifest.concepts.map((concept) => {
      const theory: TheoryFile[] = concept.theoryFiles.map((filename) => {
        const source = theoryBucket.get(filename) ?? '';
        return { filename, source };
      });
      const exercises: ExerciseFileBundle[] = concept.exerciseFiles.map((filename) => {
        const raw = exerciseBucket.get(filename);
        if (raw === undefined) {
          throw new TopicLoadError(slug, filename, 'exercise file missing from glob input');
        }
        const parsed = parseExerciseFile(slug, filename, raw);
        for (const exercise of parsed) {
          if (exercise.concept !== concept.id) {
            throw new TopicLoadError(
              slug,
              filename,
              `exercise ${exercise.id} declares concept "${exercise.concept}" but lives in concept "${concept.id}"`,
            );
          }
        }
        return { filename, exercises: parsed };
      });
      return { conceptId: concept.id, theory, exercises };
    });

    return { manifest, concepts };
  };

  return { list, load };
};
