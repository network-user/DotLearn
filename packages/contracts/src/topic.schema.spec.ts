import { describe, expect, it } from 'vitest';

import {
  EXERCISE_FILE_PATTERN,
  THEORY_FILE_PATTERN,
  TopicManifest,
  languageOfTopicFile,
} from './topic.schema';

const valid = () => ({
  slug: 'demo',
  title: 'Demo Topic',
  version: '1.0.0',
  availableLanguages: ['ru', 'en'],
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
      theoryFiles: ['theory/01-intro.ru.mdx', 'theory/01-intro.en.mdx'],
      exerciseFiles: ['exercises/01-intro.ru.yaml', 'exercises/01-intro.en.yaml'],
    },
  ],
  license: 'MIT',
});

describe('TopicManifest', () => {
  it('accepts a valid manifest', () => {
    expect(TopicManifest.safeParse(valid()).success).toBe(true);
  });

  it('rejects duplicate availableLanguages', () => {
    expect(
      TopicManifest.safeParse({ ...valid(), availableLanguages: ['ru', 'ru'], primaryLanguage: 'ru' })
        .success,
    ).toBe(false);
  });

  it('rejects primaryLanguage not listed in availableLanguages', () => {
    const m = valid();
    const result = TopicManifest.safeParse({
      ...m,
      availableLanguages: ['ru'],
      primaryLanguage: 'en',
      concepts: [
        {
          ...m.concepts[0],
          theoryFiles: ['theory/01-intro.ru.mdx'],
          exerciseFiles: ['exercises/01-intro.ru.yaml'],
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects duplicate concept ids', () => {
    const m = valid();
    expect(
      TopicManifest.safeParse({ ...m, estimatedHours: 2, concepts: [m.concepts[0], m.concepts[0]] })
        .success,
    ).toBe(false);
  });

  it('rejects a concept missing a file for an available language', () => {
    const m = valid();
    const result = TopicManifest.safeParse({
      ...m,
      concepts: [{ ...m.concepts[0], theoryFiles: ['theory/01-intro.ru.mdx'] }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects estimatedHours drifting more than 25% from concept minutes', () => {
    expect(TopicManifest.safeParse({ ...valid(), estimatedHours: 10 }).success).toBe(false);
  });

  it('rejects a bad slug', () => {
    expect(TopicManifest.safeParse({ ...valid(), slug: 'Bad_Slug' }).success).toBe(false);
  });

  it('rejects unknown keys (strict)', () => {
    expect(TopicManifest.safeParse({ ...valid(), surprise: true }).success).toBe(false);
  });
});

describe('file helpers', () => {
  it('detects the language of a topic file', () => {
    expect(languageOfTopicFile('theory/01-intro.ru.mdx')).toBe('ru');
    expect(languageOfTopicFile('exercises/01-intro.en.yaml')).toBe('en');
    expect(languageOfTopicFile('theory/01-intro.mdx')).toBeUndefined();
  });

  it('enforces the theory and exercise file patterns', () => {
    expect(THEORY_FILE_PATTERN.test('theory/01-intro.ru.mdx')).toBe(true);
    expect(THEORY_FILE_PATTERN.test('theory/intro.ru.mdx')).toBe(false);
    expect(EXERCISE_FILE_PATTERN.test('exercises/02-joins.en.yaml')).toBe(true);
    expect(EXERCISE_FILE_PATTERN.test('exercises/02-joins.txt')).toBe(false);
  });
});
