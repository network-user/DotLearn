import { describe, expect, it } from 'vitest';

import { normalizeCodeish, normalizeStdout, stdoutMatches } from './normalize';

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

describe('normalizeStdout', () => {
  it('treats a trailing newline as insignificant', () => {
    expect(normalizeStdout("['_A__id']\n")).toBe(normalizeStdout("['_A__id']"));
    expect(normalizeStdout('2\n')).toBe(normalizeStdout('2'));
    expect(normalizeStdout('1\n2\n')).toBe(normalizeStdout('1\n2'));
  });

  it('strips multiple trailing newlines from YAML block-scalar artifacts', () => {
    expect(normalizeStdout("['_A__id']\n\n")).toBe(normalizeStdout("['_A__id']"));
  });

  it('unifies CRLF with LF before comparing', () => {
    expect(normalizeStdout('1\r\n2\r\n')).toBe(normalizeStdout('1\n2'));
  });

  it('preserves mid-string blank lines', () => {
    expect(normalizeStdout('a\n\nb')).toBe('a\n\nb');
    expect(normalizeStdout('a\n\nb')).not.toBe(normalizeStdout('a\nb'));
  });

  it('still applies code-ish quote and spacing leniency per line', () => {
    expect(normalizeStdout("['a', 'b']\n")).toBe(normalizeStdout('[ "a" , "b" ]'));
  });
});

describe('stdoutMatches', () => {
  it('matches equal multi-line print output', () => {
    expect(stdoutMatches('0\n1', '0\n1')).toBe(true);
    expect(stdoutMatches('0\n1\n', '0\n1')).toBe(true);
  });

  it('matches space-separated tokens when expected has no blank lines', () => {
    expect(stdoutMatches('0 1', '0\n1')).toBe(true);
    expect(stdoutMatches('0  1', '0\n1\n')).toBe(true);
    expect(stdoutMatches('False True', 'False\nTrue')).toBe(true);
    expect(stdoutMatches('5 1 4', '5\n1\n4')).toBe(true);
    expect(stdoutMatches('console: ok queue <- ok', 'console: ok\nqueue <- ok')).toBe(true);
  });

  it('keeps blank lines significant', () => {
    expect(stdoutMatches('Анна\nконец', 'Анна\n\nконец')).toBe(false);
    expect(stdoutMatches('Анна\n\nконец', 'Анна\n\nконец')).toBe(true);
    expect(stdoutMatches('Анна  конец', 'Анна\n\nконец')).toBe(false);
  });

  it('still distinguishes real content differences', () => {
    expect(stdoutMatches("['a','b']", "['a','c']")).toBe(false);
    expect(stdoutMatches('0 1', '0 2')).toBe(false);
    expect(stdoutMatches('ab', 'a b')).toBe(false);
  });
});
