import { describe, expect, it } from 'vitest';

import { levenshtein, scoreDocument, tokenize, tokenMatchScore } from './fuzzy';

describe('fuzzy tokenize bounds', () => {
  it('caps individual token length so a giant token cannot drive a huge Levenshtein matrix', () => {
    const huge = 'a'.repeat(10_000);
    const tokens = tokenize(huge);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]?.length).toBeLessThanOrEqual(64);
  });

  it('caps the number of tokens to bound per-query work', () => {
    const many = Array.from({ length: 500 }, (_, i) => `t${i}`).join(' ');
    expect(tokenize(many).length).toBeLessThanOrEqual(32);
  });
});

describe('tokenMatchScore early-exit is lossless and bounded', () => {
  it('returns 0 for a very long query token vs a short candidate without a costly match', () => {
    const longToken = 'x'.repeat(5_000);
    expect(tokenMatchScore(longToken, 'python')).toBe(0);
  });

  it('still scores genuine matches and typos identically to the underlying distance', () => {
    expect(tokenMatchScore('python', 'python')).toBeGreaterThan(1);
    expect(tokenMatchScore('pythn', 'python')).toBeGreaterThan(0);
    expect(levenshtein('pythn', 'python')).toBe(1);
  });

  it('skips the Levenshtein DP when the length gap exceeds the fuzziness threshold', () => {
    expect(tokenMatchScore('xyz', 'category-extremely-long-token')).toBe(0);
  });
});

describe('scoreDocument stays meaningful under bounded input', () => {
  it('matches a real token even when the query carries extra junk length', () => {
    const score = scoreDocument(`django ${'z'.repeat(500)}`, {
      title: 'Django ORM deep dive',
      outline: 'querysets',
      tags: ['python'],
    });
    expect(score).toBeGreaterThan(0);
  });
});
