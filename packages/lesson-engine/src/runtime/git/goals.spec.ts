import type { GitGoalAssertion } from '@dotlearn/contracts';
import { describe, expect, it } from 'vitest';

import { createGitRepo } from './engine';
import { evaluateGitGoals } from './goals';

const buildCommitted = () => {
  const repo = createGitRepo({ files: { 'README.md': '# hi\n' }, commands: ['git init'] });
  repo.exec('git add README.md');
  repo.exec('git commit -m "initial commit"');
  return repo;
};

describe('evaluateGitGoals', () => {
  it('passes a satisfied goal set', () => {
    const repo = buildCommitted();
    const goal: GitGoalAssertion[] = [
      { kind: 'commit-count', ref: 'HEAD', equals: 1 },
      { kind: 'file-tracked', path: 'README.md' },
      { kind: 'clean-tree' },
      { kind: 'commit-message', ref: 'HEAD', index: 0, contains: 'initial' },
      { kind: 'head-on-branch', name: 'main' },
    ];
    const evaluation = evaluateGitGoals(repo, goal);
    expect(evaluation.met).toBe(true);
    expect(evaluation.results.every((result) => result.ok)).toBe(true);
  });

  it('reports the unmet assertions', () => {
    const repo = buildCommitted();
    const goal: GitGoalAssertion[] = [
      { kind: 'commit-count', ref: 'HEAD', equals: 2 },
      { kind: 'branch-exists', name: 'feature' },
    ];
    const evaluation = evaluateGitGoals(repo, goal);
    expect(evaluation.met).toBe(false);
    expect(evaluation.results.filter((result) => !result.ok)).toHaveLength(2);
  });

  it('evaluates file-content in worktree and head locations', () => {
    const repo = buildCommitted();
    repo.exec('echo draft > README.md');
    const worktree = evaluateGitGoals(repo, [
      { kind: 'file-content', path: 'README.md', equals: 'draft\n', where: 'worktree' },
    ]);
    expect(worktree.met).toBe(true);
    const head = evaluateGitGoals(repo, [
      { kind: 'file-content', path: 'README.md', equals: '# hi\n', where: 'head' },
    ]);
    expect(head.met).toBe(true);
  });

  it('evaluates file-absent and head-detached', () => {
    const repo = buildCommitted();
    const absent = evaluateGitGoals(repo, [
      { kind: 'file-absent', path: 'missing.txt', where: 'worktree' },
    ]);
    expect(absent.met).toBe(true);
    const detached = evaluateGitGoals(repo, [{ kind: 'head-detached' }]);
    expect(detached.met).toBe(false);
  });
});
