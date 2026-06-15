import { describe, expect, it } from 'vitest';

import { compareRows, formatRowDiff } from './rows';

describe('compareRows (unordered)', () => {
  it('matches the same rows in a different order and flags misordered', () => {
    const diff = compareRows([{ id: 2 }, { id: 1 }], [{ id: 1 }, { id: 2 }]);
    expect(diff.ok).toBe(true);
    expect(diff.misordered).toBe(true);
    expect(diff.missing).toEqual([]);
    expect(diff.extra).toEqual([]);
  });

  it('matches identical rows in the same order without misordered', () => {
    const diff = compareRows([{ id: 1 }, { id: 2 }], [{ id: 1 }, { id: 2 }]);
    expect(diff.ok).toBe(true);
    expect(diff.misordered).toBe(false);
  });

  it('treats rows as a multiset where duplicate counts matter', () => {
    const diff = compareRows([{ v: 1 }], [{ v: 1 }, { v: 1 }]);
    expect(diff.ok).toBe(false);
    expect(diff.missing).toEqual([{ v: 1 }]);
  });

  it('reports extra rows', () => {
    const diff = compareRows([{ v: 1 }, { v: 2 }], [{ v: 1 }]);
    expect(diff.ok).toBe(false);
    expect(diff.extra).toEqual([{ v: 2 }]);
  });

  it('collects expected and actual columns in first-seen order', () => {
    const diff = compareRows([{ a: 1, b: 2 }], [{ a: 1, c: 3 }]);
    expect(diff.expectedColumns).toEqual(['a', 'c']);
    expect(diff.actualColumns).toEqual(['a', 'b']);
  });
});

describe('compareRows (ordered)', () => {
  it('passes rows in the exact expected order', () => {
    const diff = compareRows([{ id: 1 }, { id: 2 }], [{ id: 1 }, { id: 2 }], { ordered: true });
    expect(diff.ok).toBe(true);
  });

  it('fails when the order differs', () => {
    const diff = compareRows([{ id: 2 }, { id: 1 }], [{ id: 1 }, { id: 2 }], { ordered: true });
    expect(diff.ok).toBe(false);
    expect(diff.missing.length).toBeGreaterThan(0);
    expect(diff.extra.length).toBeGreaterThan(0);
  });

  it('fails on a length mismatch', () => {
    const diff = compareRows([{ id: 1 }], [{ id: 1 }, { id: 2 }], { ordered: true });
    expect(diff.ok).toBe(false);
    expect(diff.missing).toEqual([{ id: 2 }]);
  });
});

describe('formatRowDiff', () => {
  it('describes a clean match', () => {
    expect(formatRowDiff(compareRows([{ id: 1 }], [{ id: 1 }]))).toBe('rows match');
  });

  it('notes when only the order differs', () => {
    expect(formatRowDiff(compareRows([{ id: 2 }, { id: 1 }], [{ id: 1 }, { id: 2 }]))).toBe(
      'rows match but order differs',
    );
  });

  it('lists missing and extra rows', () => {
    const text = formatRowDiff(compareRows([{ v: 2 }], [{ v: 1 }]));
    expect(text).toContain('missing row');
    expect(text).toContain('extra row');
  });
});
