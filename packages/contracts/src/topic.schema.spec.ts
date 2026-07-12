import { describe, expect, it } from 'vitest';

import {
  EXERCISE_FILE_PATTERN,
  THEORY_FILE_PATTERN,
  TopicManifest,
  TopicManifestObject,
  languageOfTopicFile,
} from './topic.schema';

const valid = () => ({
  slug: 'demo',
  title: 'Demo Topic',
  titleEn: 'Demo Topic',
  descriptions: {
    ru: 'Учебная тема для тестов схемы манифеста: поля, языковые правила и структура концептов.',
    en: 'A demo topic used by the manifest schema tests: field shapes, language rules and concept structure.',
  },
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
      titleEn: 'Intro concept (en)',
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
      TopicManifest.safeParse({
        ...valid(),
        availableLanguages: ['ru', 'ru'],
        primaryLanguage: 'ru',
      }).success,
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

  it('accepts an optional sources array', () => {
    expect(
      TopicManifest.safeParse({
        ...valid(),
        sources: [{ title: 'PostgreSQL docs', url: 'https://www.postgresql.org/docs/' }],
      }).success,
    ).toBe(true);
  });

  it('treats sources as optional', () => {
    const parsed = TopicManifest.parse(valid());
    expect(parsed.sources).toBeUndefined();
  });

  it('rejects a source with an invalid url', () => {
    expect(
      TopicManifest.safeParse({
        ...valid(),
        sources: [{ title: 'Broken', url: 'not-a-url' }],
      }).success,
    ).toBe(false);
  });

  it('rejects a source with a javascript: scheme url', () => {
    expect(
      TopicManifest.safeParse({
        ...valid(),
        sources: [{ title: 'XSS', url: 'javascript:alert(1)' }],
      }).success,
    ).toBe(false);
  });

  it('rejects a source missing a title', () => {
    expect(
      TopicManifest.safeParse({
        ...valid(),
        sources: [{ url: 'https://example.com' }],
      }).success,
    ).toBe(false);
  });

  it('accepts optional relatedTopics distinct from prerequisites', () => {
    const result = TopicManifest.safeParse({
      ...valid(),
      prerequisites: ['python-oop'],
      relatedTopics: ['fastapi', 'celery'],
    });
    expect(result.success).toBe(true);
  });

  it('parses without relatedTopics (field stays optional)', () => {
    const result = TopicManifest.safeParse(valid());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.relatedTopics).toBeUndefined();
    }
  });

  it('rejects relatedTopics that duplicate a prerequisite', () => {
    const result = TopicManifest.safeParse({
      ...valid(),
      prerequisites: ['python-oop'],
      relatedTopics: ['python-oop'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects relatedTopics that reference the topic itself', () => {
    const result = TopicManifest.safeParse({ ...valid(), relatedTopics: ['demo'] });
    expect(result.success).toBe(false);
  });

  it('rejects duplicate relatedTopics', () => {
    const result = TopicManifest.safeParse({
      ...valid(),
      relatedTopics: ['fastapi', 'fastapi'],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a relatedTopics entry with an invalid slug', () => {
    const result = TopicManifest.safeParse({ ...valid(), relatedTopics: ['Bad_Slug'] });
    expect(result.success).toBe(false);
  });

  it('rejects a manifest without a primary-language description', () => {
    const m: Record<string, unknown> = { ...valid() };
    delete m.descriptions;
    expect(TopicManifest.safeParse(m).success).toBe(false);
  });

  it('rejects an en-available manifest without descriptions.en', () => {
    const m = valid();
    expect(TopicManifest.safeParse({ ...m, descriptions: { ru: m.descriptions.ru } }).success).toBe(
      false,
    );
  });

  it('rejects an en-available manifest without titleEn', () => {
    const m: Record<string, unknown> = { ...valid() };
    delete m.titleEn;
    expect(TopicManifest.safeParse(m).success).toBe(false);
  });

  it('applies the ru-only rules for titleEn and descriptions keys', () => {
    const m = valid();
    const ruOnly: Record<string, unknown> = {
      ...m,
      availableLanguages: ['ru'],
      descriptions: { ru: m.descriptions.ru },
      concepts: [
        {
          id: m.concepts[0].id,
          title: m.concepts[0].title,
          estimatedMinutes: m.concepts[0].estimatedMinutes,
          theoryFiles: ['theory/01-intro.ru.mdx'],
          exerciseFiles: ['exercises/01-intro.ru.yaml'],
        },
      ],
    };
    delete ruOnly.titleEn;
    expect(TopicManifest.safeParse(ruOnly).success).toBe(true);
    expect(TopicManifest.safeParse({ ...ruOnly, titleEn: 'Not allowed' }).success).toBe(false);
    expect(
      TopicManifest.safeParse({
        ...ruOnly,
        descriptions: { ru: m.descriptions.ru, en: m.descriptions.en },
      }).success,
    ).toBe(false);
  });
});

describe('TopicManifestObject (runtime list-path schema)', () => {
  it('applies the prerequisites default', () => {
    const input: Record<string, unknown> = { ...valid() };
    delete input.prerequisites;
    const parsed = TopicManifestObject.parse(input);
    expect(parsed.prerequisites).toEqual([]);
  });

  it('skips the cross-field superRefine that TopicManifest enforces', () => {
    expect(TopicManifestObject.safeParse({ ...valid(), estimatedHours: 10 }).success).toBe(true);
    expect(TopicManifest.safeParse({ ...valid(), estimatedHours: 10 }).success).toBe(false);
  });

  it('still validates field shapes (rejects a bad slug)', () => {
    expect(TopicManifestObject.safeParse({ ...valid(), slug: 'Bad_Slug' }).success).toBe(false);
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
