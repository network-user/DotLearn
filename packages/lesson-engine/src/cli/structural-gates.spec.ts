import { describe, expect, it } from 'vitest';
import type { Exercise } from '@dotlearn/contracts';

import type { TopicBundle } from '../loader/source';
import {
  checkCoverage,
  checkLanguageParity,
  checkPrerequisites,
  checkSlugUniqueness,
  languageOfFile,
} from './structural-gates';

const quiz = (id: string, difficulty: number): Exercise =>
  ({
    id,
    concept: 'intro',
    type: 'theory-quiz',
    difficulty,
    prompt: 'pick one',
    choices: [
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B' },
    ],
    correct: ['a'],
  }) as unknown as Exercise;

const bundleWith = (
  concepts: Array<{ conceptId: string; files: Array<{ filename: string; exercises: Exercise[] }> }>,
  overrides: Partial<TopicBundle['manifest']> = {},
): TopicBundle =>
  ({
    manifest: {
      slug: 'demo',
      title: 'Demo',
      availableLanguages: ['ru'],
      primaryLanguage: 'ru',
      runtime: 'none',
      difficulty: 'beginner',
      prerequisites: [],
      concepts: concepts.map((concept) => ({ id: concept.conceptId })),
      ...overrides,
    },
    concepts: concepts.map((concept) => ({
      conceptId: concept.conceptId,
      theory: [],
      exercises: concept.files,
    })),
  }) as unknown as TopicBundle;

describe('languageOfFile', () => {
  it('extracts the two-letter language from yaml and mdx names', () => {
    expect(languageOfFile('exercises/01-intro.ru.yaml')).toBe('ru');
    expect(languageOfFile('theory/00-overview.en.mdx')).toBe('en');
    expect(languageOfFile('exercises/01-intro.yaml')).toBe('unknown');
  });
});

describe('checkSlugUniqueness', () => {
  it('passes for distinct slugs', () => {
    expect(checkSlugUniqueness(['a', 'b', 'c'])).toEqual([]);
  });

  it('flags duplicated slugs', () => {
    const findings = checkSlugUniqueness(['a', 'b', 'a']);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.scope).toBe('a');
  });
});

describe('checkPrerequisites', () => {
  it('passes when every prerequisite resolves', () => {
    expect(checkPrerequisites('demo', ['base'], new Set(['demo', 'base']))).toEqual([]);
  });

  it('flags a self-referential prerequisite', () => {
    const findings = checkPrerequisites('demo', ['demo'], new Set(['demo']));
    expect(findings[0]?.reason).toMatch(/itself/);
  });

  it('flags a prerequisite that does not resolve', () => {
    const findings = checkPrerequisites('demo', ['ghost'], new Set(['demo']));
    expect(findings[0]?.reason).toMatch(/does not resolve/);
  });
});

describe('checkCoverage', () => {
  it('passes with three exercises spanning easy and hard', () => {
    const bundle = bundleWith([
      {
        conceptId: 'intro',
        files: [
          {
            filename: 'exercises/01-intro.ru.yaml',
            exercises: [quiz('e1', 1), quiz('e2', 2), quiz('e3', 4)],
          },
        ],
      },
    ]);
    expect(checkCoverage(bundle)).toEqual([]);
  });

  it('flags a concept with fewer than three distinct exercises', () => {
    const bundle = bundleWith([
      {
        conceptId: 'intro',
        files: [
          { filename: 'exercises/01-intro.ru.yaml', exercises: [quiz('e1', 1), quiz('e2', 4)] },
        ],
      },
    ]);
    const findings = checkCoverage(bundle);
    expect(findings.some((finding) => /at least 3/.test(finding.reason))).toBe(true);
  });

  it('flags a concept lacking a consolidation exercise', () => {
    const bundle = bundleWith([
      {
        conceptId: 'intro',
        files: [
          {
            filename: 'exercises/01-intro.ru.yaml',
            exercises: [quiz('e1', 1), quiz('e2', 2), quiz('e3', 2)],
          },
        ],
      },
    ]);
    const findings = checkCoverage(bundle);
    expect(findings.some((finding) => /consolidation/.test(finding.reason))).toBe(true);
  });
});

describe('checkLanguageParity', () => {
  it('passes when both languages share ids and structure', () => {
    const bundle = bundleWith([
      {
        conceptId: 'intro',
        files: [
          { filename: 'exercises/01-intro.ru.yaml', exercises: [quiz('e1', 1)] },
          { filename: 'exercises/01-intro.en.yaml', exercises: [quiz('e1', 1)] },
        ],
      },
    ]);
    expect(checkLanguageParity(bundle)).toEqual([]);
  });

  it('flags an exercise missing from one language', () => {
    const bundle = bundleWith([
      {
        conceptId: 'intro',
        files: [
          { filename: 'exercises/01-intro.en.yaml', exercises: [quiz('e1', 1), quiz('e2', 1)] },
          { filename: 'exercises/01-intro.ru.yaml', exercises: [quiz('e1', 1)] },
        ],
      },
    ]);
    const findings = checkLanguageParity(bundle);
    expect(findings.some((finding) => /missing/.test(finding.reason))).toBe(true);
  });

  it('flags a structural difference across languages', () => {
    const bundle = bundleWith([
      {
        conceptId: 'intro',
        files: [
          { filename: 'exercises/01-intro.en.yaml', exercises: [quiz('e1', 1)] },
          { filename: 'exercises/01-intro.ru.yaml', exercises: [quiz('e1', 3)] },
        ],
      },
    ]);
    const findings = checkLanguageParity(bundle);
    expect(findings.some((finding) => /structure differs/.test(finding.reason))).toBe(true);
  });
});
