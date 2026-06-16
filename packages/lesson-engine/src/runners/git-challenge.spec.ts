import type { GitChallengeExercise } from '@dotlearn/contracts';
import { describe, expect, it } from 'vitest';

import { runGitChallenge } from './git-challenge';

const exercise: GitChallengeExercise = {
  id: 'first-commit',
  concept: 'staging',
  difficulty: 2,
  prompt: 'Stage and commit README.md so HEAD has exactly one commit',
  type: 'git-challenge',
  setup: {
    files: { 'README.md': '# project\n' },
    commands: ['git init'],
  },
  goal: [
    { kind: 'commit-count', ref: 'HEAD', equals: 1 },
    { kind: 'file-tracked', path: 'README.md' },
    { kind: 'clean-tree' },
  ],
  solution: ['git add README.md', 'git commit -m "init"'],
};

describe('runGitChallenge', () => {
  it('passes when the solution meets the goal (array answer)', () => {
    const result = runGitChallenge(exercise, exercise.solution);
    expect(result.ok).toBe(true);
  });

  it('passes when the answer is a newline-joined string', () => {
    const result = runGitChallenge(exercise, exercise.solution.join('\n'));
    expect(result.ok).toBe(true);
  });

  it('fails with git-goal-unmet when the commit is missing', () => {
    const result = runGitChallenge(exercise, ['git add README.md']);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.code).toBe('git-goal-unmet');
    expect(result.params).toMatchObject({ failed: 3, total: 3 });
  });

  it('fails with git-command-error on an invalid command', () => {
    const result = runGitChallenge(exercise, ['git add README.md', 'git frobnicate']);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.code).toBe('git-command-error');
  });

  it('ignores failed commands when replaying a solution with a typo followed by success', () => {
    const typoThenSolution = [
      'git stauts',
      'git add README.md',
      'git commit -m "init"',
    ];
    const result = runGitChallenge(exercise, typoThenSolution);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.code).toBe('git-command-error');
  });

  it('passes when only successful commands are replayed after a typo', () => {
    const successfulOnly = ['git add README.md', 'git commit -m "init"'];
    const result = runGitChallenge(exercise, successfulOnly);
    expect(result.ok).toBe(true);
  });
});
