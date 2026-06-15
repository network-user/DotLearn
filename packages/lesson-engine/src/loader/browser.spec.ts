import { describe, expect, it } from 'vitest';

import { createBrowserTopicSource, createLazyTopicSource } from './browser';
import { TopicLoadError, TopicNotFoundError } from './source';

const manifest = (slug: string) => ({
  slug,
  title: `Topic ${slug}`,
  version: '1.0.0',
  availableLanguages: ['ru'],
  primaryLanguage: 'ru',
  difficulty: 'beginner',
  estimatedHours: 1,
  runtime: 'none',
  prerequisites: [],
  tags: ['demo'],
  author: { kind: 'agent', name: 'Tester' },
  concepts: [
    {
      id: 'intro',
      title: 'Intro concept',
      estimatedMinutes: 60,
      theoryFiles: ['theory/01-intro.ru.mdx'],
      exerciseFiles: ['exercises/01-intro.ru.yaml'],
    },
  ],
  license: 'MIT',
});

const exerciseYaml = (concept = 'intro') => `
exercises:
  - id: q1
    concept: ${concept}
    difficulty: 1
    prompt: Pick the correct answer
    type: theory-quiz
    choices:
      - id: a
        text: Option A
      - id: b
        text: Option B
    correct:
      - a
`;

describe('createLazyTopicSource', () => {
  const build = (exercises?: Record<string, () => Promise<string>>) =>
    createLazyTopicSource({
      manifests: {
        '/topics/alpha/manifest.json': manifest('alpha'),
        '/topics/beta/manifest.json': manifest('beta'),
      },
      exercises: exercises ?? {
        '/topics/alpha/exercises/01-intro.ru.yaml': () => Promise.resolve(exerciseYaml()),
        '/topics/beta/exercises/01-intro.ru.yaml': () => Promise.resolve(exerciseYaml()),
      },
    });

  it('lists slugs sorted', async () => {
    expect(await build().list()).toEqual(['alpha', 'beta']);
  });

  it('loads a bundle with parsed exercises', async () => {
    const bundle = await build().load('alpha');
    expect(bundle.manifest.slug).toBe('alpha');
    expect(bundle.concepts[0]?.exercises[0]?.exercises[0]?.id).toBe('q1');
  });

  it('throws TopicNotFoundError for an unknown slug', async () => {
    await expect(build().load('missing')).rejects.toBeInstanceOf(TopicNotFoundError);
  });

  it('skips exercise files for a language that is not requested', async () => {
    const bundle = await build().load('alpha', { languages: ['en'] });
    expect(bundle.concepts[0]?.exercises).toEqual([]);
  });

  it('throws when an exercise declares a mismatched concept', async () => {
    const source = build({
      '/topics/alpha/exercises/01-intro.ru.yaml': () =>
        Promise.resolve(exerciseYaml('wrong-concept')),
    });
    await expect(source.load('alpha')).rejects.toBeInstanceOf(TopicLoadError);
  });

  it('throws when an exercise importer is missing', async () => {
    await expect(build({}).load('alpha')).rejects.toBeInstanceOf(TopicLoadError);
  });
});

describe('createBrowserTopicSource', () => {
  it('loads eagerly provided exercises', async () => {
    const source = createBrowserTopicSource({
      manifests: { '/topics/alpha/manifest.json': manifest('alpha') },
      exercises: { '/topics/alpha/exercises/01-intro.ru.yaml': exerciseYaml() },
    });
    const bundle = await source.load('alpha');
    expect(bundle.concepts[0]?.exercises[0]?.exercises[0]?.id).toBe('q1');
  });
});
