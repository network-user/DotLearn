import { describe, expect, it } from 'vitest';

import { Exercise, GitGoalAssertion, isGitChallenge } from './exercise.schema';

const validGitChallenge = {
  id: 'first-commit',
  concept: 'staging',
  difficulty: 2,
  prompt: 'Commit the staged file so HEAD has exactly one commit',
  type: 'git-challenge',
  setup: {
    files: { 'README.md': '# project\n' },
    commands: ['git init'],
  },
  goal: [
    { kind: 'commit-count', equals: 1 },
    { kind: 'file-tracked', path: 'README.md' },
    { kind: 'clean-tree' },
  ],
  solution: ['git add README.md', 'git commit -m "init"'],
  hints: ['Stage with git add', 'Then git commit -m'],
};

describe('GitChallengeExercise schema', () => {
  it('parses a valid git-challenge exercise', () => {
    const result = Exercise.safeParse(validGitChallenge);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('git-challenge');
      expect(isGitChallenge(result.data)).toBe(true);
    }
  });

  it('applies defaults on goal assertions', () => {
    const result = GitGoalAssertion.safeParse({ kind: 'commit-count', equals: 2 });
    expect(result.success).toBe(true);
    if (result.success && result.data.kind === 'commit-count') {
      expect(result.data.ref).toBe('HEAD');
    }
  });

  it('defaults file-content where to worktree and commit-message index to 0', () => {
    const content = GitGoalAssertion.parse({
      kind: 'file-content',
      path: 'a.txt',
      equals: 'x',
    });
    expect(content.kind === 'file-content' && content.where).toBe('worktree');
    const message = GitGoalAssertion.parse({
      kind: 'commit-message',
      contains: 'fix',
    });
    expect(message.kind === 'commit-message' && message.index).toBe(0);
    expect(message.kind === 'commit-message' && message.ref).toBe('HEAD');
  });

  it('accepts every goal kind', () => {
    const kinds = [
      { kind: 'commit-count', equals: 1 },
      { kind: 'file-content', path: 'a', equals: 'b' },
      { kind: 'file-tracked', path: 'a' },
      { kind: 'file-absent', path: 'a' },
      { kind: 'staged', path: 'a' },
      { kind: 'branch-exists', name: 'feature' },
      { kind: 'branch-absent', name: 'feature' },
      { kind: 'head-on-branch', name: 'main' },
      { kind: 'head-detached' },
      { kind: 'head-at', ref: 'main' },
      { kind: 'clean-tree' },
      { kind: 'merged', branch: 'feature' },
      { kind: 'commit-message', contains: 'fix' },
      { kind: 'tag-exists', name: 'v1' },
    ];
    for (const kind of kinds) {
      expect(GitGoalAssertion.safeParse(kind).success).toBe(true);
    }
  });

  it('rejects an empty goal array', () => {
    expect(Exercise.safeParse({ ...validGitChallenge, goal: [] }).success).toBe(false);
  });

  it('rejects an empty solution array', () => {
    expect(Exercise.safeParse({ ...validGitChallenge, solution: [] }).success).toBe(false);
  });

  it('rejects an unknown goal kind', () => {
    expect(
      Exercise.safeParse({
        ...validGitChallenge,
        goal: [{ kind: 'mystery', equals: 1 }],
      }).success,
    ).toBe(false);
  });

  it('rejects a commit-count assertion missing equals', () => {
    expect(GitGoalAssertion.safeParse({ kind: 'commit-count' }).success).toBe(false);
  });

  it('rejects a file-content assertion missing path', () => {
    expect(GitGoalAssertion.safeParse({ kind: 'file-content', equals: 'x' }).success).toBe(false);
  });
});
