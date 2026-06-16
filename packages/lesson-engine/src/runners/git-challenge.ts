import type { GitChallengeExercise } from '@dotlearn/contracts';

import { createGitRepo, evaluateGitGoals, GitError } from '../runtime/git';
import { failCoded, pass, type RunResult } from './result';

const toCommandList = (answer: string | string[]): string[] => {
  if (Array.isArray(answer)) {
    return answer;
  }
  return answer.split('\n');
};

export const runGitChallenge = (
  exercise: GitChallengeExercise,
  answer: string | string[],
): RunResult => {
  const init: { files?: Record<string, string>; commands?: string[] } = {};
  if (exercise.setup?.files !== undefined) {
    init.files = exercise.setup.files;
  }
  if (exercise.setup?.commands !== undefined) {
    init.commands = exercise.setup.commands;
  }
  let repo;
  try {
    repo = createGitRepo(init);
  } catch (error) {
    if (error instanceof GitError) {
      return failCoded('git-command-error', `setup failed: ${error.message}`, undefined, {
        stage: 'setup',
        message: error.message,
      });
    }
    throw error;
  }

  const commands = toCommandList(answer);
  for (const command of commands) {
    const trimmed = command.trim();
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }
    const result = repo.exec(trimmed);
    if (result.code !== 0) {
      return failCoded(
        'git-command-error',
        `command failed: "${trimmed}"`,
        { command: trimmed },
        { command: trimmed, stderr: result.stderr, code: result.code },
      );
    }
  }

  const evaluation = evaluateGitGoals(repo, exercise.goal);
  if (evaluation.met) {
    return pass({ results: evaluation.results, snapshot: repo.snapshot() });
  }
  const failed = evaluation.results.filter((result) => !result.ok);
  return failCoded(
    'git-goal-unmet',
    `${failed.length} goal assertion(s) not satisfied`,
    { failed: failed.length, total: evaluation.results.length },
    { results: evaluation.results, failed },
  );
};
