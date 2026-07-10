import { createGitRepo } from '@dotlearn/lesson-engine';
import { describe, expect, it } from 'vitest';

import { completeCommand } from './completions';

const buildSnapshot = () => {
  const repo = createGitRepo({
    files: { 'README.md': '# hi\n', 'src/index.ts': '' },
    commands: ['git init'],
  });
  repo.exec('git add README.md');
  repo.exec('git commit -m "initial commit"');
  repo.exec('git branch feature');
  repo.exec('git tag v1.0');
  return repo.snapshot();
};

describe('completeCommand', () => {
  it('lists every top-level command for an empty draft', () => {
    const result = completeCommand('', null);
    expect(result.completed).toBeUndefined();
    expect(result.candidates).toEqual([
      'git',
      'echo',
      'cat',
      'ls',
      'rm',
      'touch',
      'mkdir',
      'pwd',
      'clear',
      'help',
    ]);
  });

  it('completes a unique first-token prefix', () => {
    const result = completeCommand('gi', null);
    expect(result.completed).toBe('git ');
    expect(result.candidates).toEqual(['git']);
  });

  it('offers git subcommand candidates sharing a prefix without a full completion', () => {
    const result = completeCommand('git che', null);
    expect(result.candidates).toEqual(['checkout', 'cherry-pick']);
    expect(result.completed).toBeUndefined();
  });

  it('offers flag candidates for a subcommand after a bare dash', () => {
    const result = completeCommand('git commit -', null);
    expect(result.candidates).toEqual(['-m', '-am', '-a', '--amend']);
    expect(result.completed).toBeUndefined();
  });

  it('lists branches, tags and files as checkout targets from the snapshot', () => {
    const snapshot = buildSnapshot();
    const result = completeCommand('git checkout ', snapshot);
    expect(result.candidates).toEqual(['feature', 'main', 'v1.0', 'README.md', 'src/index.ts']);
    expect(result.completed).toBeUndefined();
  });

  it('completes a unique branch name with a trailing space', () => {
    const snapshot = buildSnapshot();
    const result = completeCommand('git checkout fe', snapshot);
    expect(result.completed).toBe('git checkout feature ');
    expect(result.candidates).toEqual(['feature']);
  });

  it('extends to the longest common prefix when several branches share one', () => {
    const repo = createGitRepo({ commands: ['git init'] });
    repo.exec('touch a.txt');
    repo.exec('git add a.txt');
    repo.exec('git commit -m "seed"');
    repo.exec('git branch feature-a');
    repo.exec('git branch feature-b');
    const snapshot = repo.snapshot();
    const result = completeCommand('git checkout feat', snapshot);
    expect(result.completed).toBe('git checkout feature-');
    expect(result.candidates).toEqual(['feature-a', 'feature-b']);
  });

  it('completes files for a builtin file command', () => {
    const snapshot = buildSnapshot();
    const result = completeCommand('cat READ', snapshot);
    expect(result.completed).toBe('cat README.md ');
    expect(result.candidates).toEqual(['README.md']);
  });

  it('returns no candidates for an unknown command', () => {
    const result = completeCommand('xyz ', null);
    expect(result.candidates).toEqual([]);
    expect(result.completed).toBeUndefined();
  });

  it('returns no branch, tag or file candidates when the snapshot is null', () => {
    const result = completeCommand('git checkout ', null);
    expect(result.candidates).toEqual([]);
    expect(result.completed).toBeUndefined();
  });
});
