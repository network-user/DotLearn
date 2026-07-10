import { describe, expect, it } from 'vitest';

import { shellTokenClassName, tokenizeShellCommand } from './shellHighlight';

describe('tokenizeShellCommand', () => {
  const sampleLines = [
    'ls',
    'ls -la',
    'git status',
    'git commit --amend',
    "echo 'hello world'",
    'echo "hello world"',
    'echo "unterminated',
    'git commit -m "x" > f.txt',
    'ls > out.txt',
    'ls >> out.txt',
    'git commit -m"msg"',
    '',
    '   ',
    'git   status',
    'foo bar',
    'echo git',
  ];

  it.each(sampleLines)('preserves the exact source text for %j', (line) => {
    const tokens = tokenizeShellCommand(line);
    expect(tokens.map((token) => token.text).join('')).toBe(line);
  });

  it('returns no tokens for an empty line', () => {
    expect(tokenizeShellCommand('')).toEqual([]);
  });

  it('classifies a known first word as a command', () => {
    const tokens = tokenizeShellCommand('ls -la');
    expect(tokens[0]).toEqual({ text: 'ls', kind: 'command' });
    expect(tokens[2]).toEqual({ text: '-la', kind: 'flag' });
  });

  it('classifies the second word after git as a subcommand', () => {
    const tokens = tokenizeShellCommand('git status');
    expect(tokens[0]).toEqual({ text: 'git', kind: 'command' });
    expect(tokens[2]).toEqual({ text: 'status', kind: 'subcommand' });
  });

  it('only treats the word directly after git as a subcommand', () => {
    const tokens = tokenizeShellCommand('git branch feature');
    expect(tokens.map((token) => token.kind)).toEqual([
      'command',
      'space',
      'subcommand',
      'space',
      'arg',
    ]);
  });

  it('does not classify a subcommand when the first word is not git', () => {
    const tokens = tokenizeShellCommand('echo git');
    expect(tokens[0]).toEqual({ text: 'echo', kind: 'command' });
    expect(tokens[2]).toEqual({ text: 'git', kind: 'arg' });
  });

  it('classifies an unknown leading word as an arg', () => {
    const tokens = tokenizeShellCommand('foo bar');
    expect(tokens[0]).toEqual({ text: 'foo', kind: 'arg' });
    expect(tokens[2]).toEqual({ text: 'bar', kind: 'arg' });
  });

  it('classifies single and double quoted strings', () => {
    const single = tokenizeShellCommand("echo 'hello world'");
    expect(single[2]).toEqual({ text: "'hello world'", kind: 'string' });
    const double = tokenizeShellCommand('echo "hello world"');
    expect(double[2]).toEqual({ text: '"hello world"', kind: 'string' });
  });

  it('treats an unterminated quote as a single string token spanning to end of line', () => {
    const tokens = tokenizeShellCommand('echo "unterminated');
    expect(tokens[2]).toEqual({ text: '"unterminated', kind: 'string' });
  });

  it('classifies > and >> as redirect tokens', () => {
    const single = tokenizeShellCommand('ls > out.txt');
    expect(single.find((token) => token.kind === 'redirect')).toEqual({
      text: '>',
      kind: 'redirect',
    });
    const double = tokenizeShellCommand('ls >> out.txt');
    expect(double.find((token) => token.kind === 'redirect')).toEqual({
      text: '>>',
      kind: 'redirect',
    });
  });

  it('classifies a full git commit line with a redirect', () => {
    const tokens = tokenizeShellCommand('git commit -m "x" > f.txt');
    expect(tokens.map((token) => token.kind)).toEqual([
      'command',
      'space',
      'subcommand',
      'space',
      'flag',
      'space',
      'string',
      'space',
      'redirect',
      'space',
      'arg',
    ]);
  });

  it('splits a flag glued to a quoted string into separate tokens', () => {
    const tokens = tokenizeShellCommand('git commit -m"msg"');
    expect(tokens).toEqual([
      { text: 'git', kind: 'command' },
      { text: ' ', kind: 'space' },
      { text: 'commit', kind: 'subcommand' },
      { text: ' ', kind: 'space' },
      { text: '-m', kind: 'flag' },
      { text: '"msg"', kind: 'string' },
    ]);
  });

  it('collapses a run of multiple spaces into a single space token', () => {
    const tokens = tokenizeShellCommand('git   status');
    expect(tokens[1]).toEqual({ text: '   ', kind: 'space' });
  });
});

describe('shellTokenClassName', () => {
  it('maps each token kind to its expected class name', () => {
    expect(shellTokenClassName('command')).toBe('text-accent font-medium');
    expect(shellTokenClassName('subcommand')).toBe('text-accent-2');
    expect(shellTokenClassName('flag')).toBe('text-warn');
    expect(shellTokenClassName('string')).toBe('text-ok');
    expect(shellTokenClassName('redirect')).toBe('text-accent-3');
    expect(shellTokenClassName('arg')).toBe('text-fg');
    expect(shellTokenClassName('space')).toBe('');
  });
});
