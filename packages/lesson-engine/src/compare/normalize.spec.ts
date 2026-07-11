import { describe, expect, it } from 'vitest';

import { normalizeCodeish } from './normalize';

describe('normalizeCodeish', () => {
  it('makes quote style irrelevant', () => {
    expect(normalizeCodeish("'a'")).toBe(normalizeCodeish('"a"'));
    expect(normalizeCodeish("{'x': 1}")).toBe(normalizeCodeish('{"x":1}'));
  });

  it('collapses spacing around structural punctuation', () => {
    expect(normalizeCodeish("['apple', 'banana']")).toBe(normalizeCodeish("['apple','banana']"));
    expect(normalizeCodeish("[ 'a' , 'b' ]")).toBe(normalizeCodeish("['a','b']"));
    expect(normalizeCodeish('{ "x" : 1 }')).toBe('{"x":1}');
    expect(normalizeCodeish('f ( a , b )')).toBe('f(a,b)');
  });

  it('collapses runs of spaces and tabs to a single space', () => {
    expect(normalizeCodeish('a   b\t\tc')).toBe('a b c');
  });

  it('trims trailing whitespace but keeps leading indentation', () => {
    expect(normalizeCodeish('foo   ')).toBe('foo');
    // Leading indentation is collapsed to one space, not removed: an indented
    // line must not become equal to a non-indented one.
    expect(normalizeCodeish('    y')).toBe(' y');
    expect(normalizeCodeish('    y')).not.toBe(normalizeCodeish('y'));
  });

  it('preserves newlines and line count', () => {
    expect(normalizeCodeish('1\n2')).toBe('1\n2');
    expect(normalizeCodeish('1\n2')).not.toBe(normalizeCodeish('1 2'));
    expect(normalizeCodeish("['a',\n'b']")).toBe('["a",\n"b"]');
  });

  it('preserves letter case', () => {
    expect(normalizeCodeish('Apple')).not.toBe(normalizeCodeish('apple'));
  });

  it('is idempotent', () => {
    const once = normalizeCodeish("[ 'a' , 'b' ]");
    expect(normalizeCodeish(once)).toBe(once);
  });
});
