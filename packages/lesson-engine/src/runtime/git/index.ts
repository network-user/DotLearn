export { GitError } from './errors';
export {
  createGitRepo,
  GitRepo,
  type CommitSnapshot,
  type ExecResult,
  type FileLocation,
  type GitRepoInit,
  type HeadSnapshot,
  type RepoSnapshot,
  type StatusSnapshot,
} from './engine';
export {
  evaluateGitGoals,
  type GoalEvaluation,
  type GoalResult,
} from './goals';
