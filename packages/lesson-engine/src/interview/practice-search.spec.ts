import { describe, expect, it } from 'vitest';

import { parseFlashcardsPracticeSearch, parseTopicsParam, topicsToParam } from './practice-search';

describe('parseFlashcardsPracticeSearch', () => {
  it('parses mode, filters, topics, and autostart', () => {
    expect(
      parseFlashcardsPracticeSearch({
        mode: 'interview',
        category: 'python-core',
        stage: 'tech',
        topics: 'git,sql',
        due: 'all',
        count: '50',
        start: '1',
      }),
    ).toEqual({
      mode: 'interview',
      category: 'python-core',
      stage: 'tech',
      topics: 'git,sql',
      due: 'all',
      count: '50',
      start: true,
    });
  });

  it('ignores invalid values', () => {
    expect(parseFlashcardsPracticeSearch({ mode: 'invalid', due: 'maybe' })).toEqual({});
  });
});

describe('parseTopicsParam', () => {
  it('keeps only known topic slugs', () => {
    expect(parseTopicsParam('git,sql,unknown', ['git', 'sql', 'oop'])).toEqual(['git', 'sql']);
  });
});

describe('topicsToParam', () => {
  it('joins slugs for the url', () => {
    expect(topicsToParam(['git', 'sql'])).toBe('git,sql');
    expect(topicsToParam([])).toBeUndefined();
  });
});
