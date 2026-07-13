import { describe, expect, it } from 'vitest';

import { parseExerciseFile, parseManifest } from './parse';
import { TopicLoadError } from './source';

const validManifest = (slug = 'demo') => ({
  slug,
  title: 'Demo Topic',
  descriptions: {
    ru: 'Демонстрационная тема для юнит-тестов загрузчика: манифест, концепты и упражнения lesson-engine.',
  },
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

const validExerciseYaml = `
exercises:
  - id: q1
    concept: intro
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

describe('parseManifest', () => {
  it('returns the parsed manifest for valid input', () => {
    const manifest = parseManifest('demo', validManifest('demo'));
    expect(manifest.slug).toBe('demo');
    expect(manifest.concepts).toHaveLength(1);
  });

  it('throws when the slug does not match the folder', () => {
    expect(() => parseManifest('other', validManifest('demo'))).toThrow(TopicLoadError);
  });

  it('throws a validation error for a malformed manifest', () => {
    expect(() =>
      parseManifest('demo', { ...validManifest('demo'), version: 'not-semver' }),
    ).toThrow(/validation failed/);
  });
});

describe('parseExerciseFile', () => {
  it('parses a valid YAML exercise file', () => {
    const exercises = parseExerciseFile('demo', 'exercises/01-intro.ru.yaml', validExerciseYaml);
    expect(exercises).toHaveLength(1);
    expect(exercises[0]?.id).toBe('q1');
  });

  it('throws on invalid YAML', () => {
    expect(() =>
      parseExerciseFile('demo', 'exercises/01-intro.ru.yaml', 'exercises: [unclosed'),
    ).toThrow(/invalid YAML/);
  });

  it('throws a validation error when the schema does not match', () => {
    const badYaml = 'exercises:\n  - id: q1\n    type: theory-quiz\n';
    expect(() => parseExerciseFile('demo', 'exercises/01-intro.ru.yaml', badYaml)).toThrow(
      /validation failed/,
    );
  });
});
