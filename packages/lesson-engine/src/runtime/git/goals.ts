import type { GitGoalAssertion } from '@dotlearn/contracts';

import type { GitRepo } from './engine';

export interface GoalResult {
  kind: string;
  ok: boolean;
  reason?: string;
}

export interface GoalEvaluation {
  met: boolean;
  results: GoalResult[];
}

const evaluateAssertion = (repo: GitRepo, assertion: GitGoalAssertion): GoalResult => {
  switch (assertion.kind) {
    case 'commit-count': {
      const actual = repo.getCommitCount(assertion.ref);
      return actual === assertion.equals
        ? { kind: assertion.kind, ok: true }
        : {
            kind: assertion.kind,
            ok: false,
            reason: `expected ${assertion.equals} commit(s) on ${assertion.ref}, found ${actual}`,
          };
    }
    case 'file-content': {
      const actual = repo.getFile(assertion.path, assertion.where);
      if (actual === assertion.equals) {
        return { kind: assertion.kind, ok: true };
      }
      return {
        kind: assertion.kind,
        ok: false,
        reason:
          actual === undefined
            ? `file "${assertion.path}" not found in ${assertion.where}`
            : `file "${assertion.path}" content does not match expected`,
      };
    }
    case 'file-tracked': {
      return repo.isTracked(assertion.path)
        ? { kind: assertion.kind, ok: true }
        : {
            kind: assertion.kind,
            ok: false,
            reason: `file "${assertion.path}" is not tracked in HEAD`,
          };
    }
    case 'file-absent': {
      const present = repo.getFile(assertion.path, assertion.where) !== undefined;
      return present
        ? {
            kind: assertion.kind,
            ok: false,
            reason: `file "${assertion.path}" should be absent from ${assertion.where}`,
          }
        : { kind: assertion.kind, ok: true };
    }
    case 'staged': {
      return repo.isStaged(assertion.path)
        ? { kind: assertion.kind, ok: true }
        : {
            kind: assertion.kind,
            ok: false,
            reason: `file "${assertion.path}" is not staged`,
          };
    }
    case 'branch-exists': {
      return repo.branchExists(assertion.name)
        ? { kind: assertion.kind, ok: true }
        : { kind: assertion.kind, ok: false, reason: `branch "${assertion.name}" does not exist` };
    }
    case 'branch-absent': {
      return repo.branchExists(assertion.name)
        ? { kind: assertion.kind, ok: false, reason: `branch "${assertion.name}" should not exist` }
        : { kind: assertion.kind, ok: true };
    }
    case 'head-on-branch': {
      const branch = repo.headBranch();
      return branch === assertion.name
        ? { kind: assertion.kind, ok: true }
        : {
            kind: assertion.kind,
            ok: false,
            reason: `HEAD is on "${branch ?? '(detached)'}", expected "${assertion.name}"`,
          };
    }
    case 'head-detached': {
      return repo.headDetached()
        ? { kind: assertion.kind, ok: true }
        : { kind: assertion.kind, ok: false, reason: 'HEAD is not detached' };
    }
    case 'head-at': {
      return repo.resolves('HEAD', assertion.ref)
        ? { kind: assertion.kind, ok: true }
        : {
            kind: assertion.kind,
            ok: false,
            reason: `HEAD does not resolve to the same commit as "${assertion.ref}"`,
          };
    }
    case 'clean-tree': {
      return repo.isClean()
        ? { kind: assertion.kind, ok: true }
        : { kind: assertion.kind, ok: false, reason: 'working tree is not clean' };
    }
    case 'merged': {
      return repo.isMerged(assertion.branch, assertion.into)
        ? { kind: assertion.kind, ok: true }
        : {
            kind: assertion.kind,
            ok: false,
            reason: `branch "${assertion.branch}" is not merged into "${assertion.into}"`,
          };
    }
    case 'commit-message': {
      const message = repo.commitMessageAt(assertion.ref, assertion.index);
      if (message !== undefined && message.includes(assertion.contains)) {
        return { kind: assertion.kind, ok: true };
      }
      return {
        kind: assertion.kind,
        ok: false,
        reason:
          message === undefined
            ? `no commit at ${assertion.ref}~${assertion.index}`
            : `commit message "${message}" does not contain "${assertion.contains}"`,
      };
    }
    case 'tag-exists': {
      return repo.tagExists(assertion.name)
        ? { kind: assertion.kind, ok: true }
        : { kind: assertion.kind, ok: false, reason: `tag "${assertion.name}" does not exist` };
    }
  }
};

export const evaluateGitGoals = (
  repo: GitRepo,
  goal: GitGoalAssertion[],
): GoalEvaluation => {
  const results = goal.map((assertion) => evaluateAssertion(repo, assertion));
  return { met: results.every((result) => result.ok), results };
};
