export type { RunFailureCode, RunFailureParams, RunResult } from './runners/result';
export { fail, failCoded, pass } from './runners/result';

export { runExercise, type RunContext } from './runners/dispatch';
export { runTheoryQuiz } from './runners/theory-quiz';
export { runSqlQuery } from './runners/sql-query';
export { runPythonFunction } from './runners/python-function';
export { runJavascriptFunction } from './runners/javascript-function';
export { runFillInBlanks } from './runners/fill-in-blanks';
export { runPredictOutput } from './runners/predict-output';
export { runGitChallenge } from './runners/git-challenge';

export type { SqlExecution, SqlRuntime } from './runtime/sql';
export { SqlExecutionError } from './runtime/sql';
export type { PythonExecution, PythonRuntime } from './runtime/python';
export { PythonExecutionError } from './runtime/python';
export type { JavascriptExecution, JavascriptRuntime } from './runtime/javascript';
export { inlineJavascriptRuntime } from './runtime/javascript';

export { createGitRepo, evaluateGitGoals, GitError, GitRepo } from './runtime/git';
export type {
  CommitSnapshot,
  ExecResult,
  FileLocation,
  GitRepoInit,
  GoalEvaluation,
  GoalResult,
  HeadSnapshot,
  RepoSnapshot,
  StatusSnapshot,
} from './runtime/git';

export {
  compareRows,
  formatRowDiff,
  type Row,
  type RowDiff,
} from './compare/rows';
export { approximatelyEqual, compareValues, type ValueComparison } from './compare/value';

export {
  createBrowserTopicSource,
  createLazyTopicSource,
  type LazyTopicGlobInput,
  type TopicGlobInput,
} from './loader/browser';
export type {
  ConceptBundle,
  ExerciseFileBundle,
  TheoryFile,
  TopicBundle,
  TopicLoadOptions,
  TopicSource,
} from './loader/source';
export { TopicLoadError, TopicNotFoundError } from './loader/source';
export { parseExerciseFile, parseFlashcardDeck, parseManifest } from './loader/parse';
export {
  cleanInterviewAnswer,
  extractInterviewAnswer,
  stripFrontmatter,
} from './interview/flashcard-text';
export {
  parseFlashcardsPracticeSearch,
  parseTopicsParam,
  practiceSearchDefaults,
  topicsToParam,
  type FlashcardsPracticeSearch,
  type PracticeDueFilter,
  type PracticeMode,
} from './interview/practice-search';
