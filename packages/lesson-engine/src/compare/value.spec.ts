import { describe, expect, it } from 'vitest';

import { approximatelyEqual, compareValues } from './value';

describe('compareValues', () => {
  it('treats equal primitives as ok', () => {
    expect(compareValues(1, 1).ok).toBe(true);
    expect(compareValues('a', 'a').ok).toBe(true);
    expect(compareValues(true, true).ok).toBe(true);
  });

  it('treats NaN as equal to NaN', () => {
    expect(compareValues(Number.NaN, Number.NaN).ok).toBe(true);
  });

  it('treats null and undefined as equivalent', () => {
    expect(compareValues(null, undefined).ok).toBe(true);
    expect(compareValues(undefined, null).ok).toBe(true);
    expect(compareValues(null, null).ok).toBe(true);
  });

  it('treats the same finite number written as number or numeric string as equal', () => {
    expect(compareValues(1, '1').ok).toBe(true);
    expect(compareValues('1', 1).ok).toBe(true);
    expect(compareValues(1.5, '1.5').ok).toBe(true);
    expect(compareValues(100, '1e2').ok).toBe(true);
  });

  it('still flags a real type mismatch with the path', () => {
    expect(compareValues(1, true)).toEqual({ ok: false, reason: 'type', path: '$' });
    expect(compareValues('yes', true)).toEqual({ ok: false, reason: 'type', path: '$' });
  });

  it('flags differing primitive values', () => {
    expect(compareValues(1, 2)).toEqual({ ok: false, reason: 'value', path: '$' });
    expect(compareValues(1, '2')).toEqual({ ok: false, reason: 'value', path: '$' });
  });

  describe('code-ish string leniency', () => {
    it('ignores spacing around structural punctuation', () => {
      expect(compareValues("['apple','banana']", "['apple', 'banana']").ok).toBe(true);
      expect(compareValues('[ 1 , 2 ]', '[1,2]').ok).toBe(true);
    });

    it('ignores quote style', () => {
      expect(compareValues("'a'", '"a"').ok).toBe(true);
      expect(compareValues("{'x': 1}", '{"x":1}').ok).toBe(true);
    });

    it('still distinguishes letter case', () => {
      expect(compareValues('Apple', 'apple')).toEqual({ ok: false, reason: 'value', path: '$' });
    });

    it('still distinguishes newline structure', () => {
      expect(compareValues('1\n2', '1 2')).toEqual({ ok: false, reason: 'value', path: '$' });
    });

    it('still fails a genuinely different value', () => {
      expect(compareValues("['a','b']", "['a','c']")).toEqual({
        ok: false,
        reason: 'value',
        path: '$',
      });
    });

    it('applies leniency to string cells nested in arrays and objects', () => {
      expect(compareValues(["['a', 'b']"], ["['a','b']"]).ok).toBe(true);
      expect(compareValues({ out: "{'k': 1}" }, { out: '{"k":1}' }).ok).toBe(true);
    });
  });

  describe('arrays', () => {
    it('passes equal arrays', () => {
      expect(compareValues([1, 2, 3], [1, 2, 3]).ok).toBe(true);
    });

    it('flags a length difference', () => {
      expect(compareValues([1, 2], [1, 2, 3])).toEqual({ ok: false, reason: 'length', path: '$' });
    });

    it('reports the path of a differing element', () => {
      expect(compareValues([1, 2, 9], [1, 2, 3])).toEqual({
        ok: false,
        reason: 'value',
        path: '$[2]',
      });
    });
  });

  describe('objects', () => {
    it('passes equal objects regardless of key order', () => {
      expect(compareValues({ a: 1, b: 2 }, { b: 2, a: 1 }).ok).toBe(true);
    });

    it('flags a missing key', () => {
      expect(compareValues({ a: 1 }, { a: 1, b: 2 })).toEqual({
        ok: false,
        reason: 'key',
        path: '$.b',
      });
    });

    it('reports a nested path', () => {
      expect(compareValues({ a: { b: 1 } }, { a: { b: 2 } })).toEqual({
        ok: false,
        reason: 'value',
        path: '$.a.b',
      });
    });

    it('accepts numeric string cells inside objects', () => {
      expect(compareValues({ n: 1 }, { n: '1' }).ok).toBe(true);
    });
  });

  describe('Set and Map', () => {
    it('compares Set membership with value leniency', () => {
      expect(compareValues(new Set([1, 2]), new Set([2, 1])).ok).toBe(true);
      expect(compareValues(new Set([1]), new Set(['1'])).ok).toBe(true);
      expect(compareValues(new Set([1]), new Set([1, 2])).ok).toBe(false);
    });

    it('compares Map entries', () => {
      expect(compareValues(new Map([['a', 1]]), new Map([['a', 1]])).ok).toBe(true);
      expect(compareValues(new Map([['a', 1]]), new Map([['a', '1']])).ok).toBe(true);
      expect(compareValues(new Map([['a', 1]]), new Map([['b', 1]])).ok).toBe(false);
    });
  });
});

describe('approximatelyEqual', () => {
  it('is true within epsilon', () => {
    expect(approximatelyEqual(0.1 + 0.2, 0.3)).toBe(true);
  });

  it('is false outside epsilon', () => {
    expect(approximatelyEqual(1, 1.5)).toBe(false);
  });

  it('is false for non-numbers', () => {
    expect(approximatelyEqual('1', 1)).toBe(false);
  });
});
