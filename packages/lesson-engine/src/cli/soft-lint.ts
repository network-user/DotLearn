import type { Exercise } from '@dotlearn/contracts';

import type { TopicBundle } from '../loader/source';

export interface LintWarning {
  scope: string;
  reason: string;
}

const WIKILINK_PATTERN = /\[\[([a-z0-9][a-z0-9-]*)\]\]/g;
const MIN_HINT_LENGTH = 15;

/** Correct may be at most this much longer than the longest wrong choice. */
export const QUIZ_MAX_CORRECT_TO_MAX_WRONG_RATIO = 1.3;

/** Correct may be at most this much longer than the average wrong choice. */
export const QUIZ_MAX_CORRECT_TO_AVG_WRONG_RATIO = 1.45;

export interface QuizChoiceLengthReport {
  biased: boolean;
  maxCorrect: number;
  maxWrong: number;
  avgWrong: number;
  ratioToMaxWrong: number;
  ratioToAvgWrong: number;
  uniquelyLongestCorrect: boolean;
  reason?: string;
}

export const analyzeQuizChoiceLengths = (
  choices: ReadonlyArray<{ id: string; text: string }>,
  correct: ReadonlyArray<string>,
): QuizChoiceLengthReport => {
  const correctSet = new Set(correct);
  const correctLengths = choices
    .filter((choice) => correctSet.has(choice.id))
    .map((choice) => choice.text.trim().length);
  const wrongLengths = choices
    .filter((choice) => !correctSet.has(choice.id))
    .map((choice) => choice.text.trim().length);

  if (correctLengths.length === 0 || wrongLengths.length === 0) {
    return {
      biased: false,
      maxCorrect: 0,
      maxWrong: 0,
      avgWrong: 0,
      ratioToMaxWrong: 0,
      ratioToAvgWrong: 0,
      uniquelyLongestCorrect: false,
    };
  }

  const maxCorrect = Math.max(...correctLengths);
  const maxWrong = Math.max(...wrongLengths);
  const avgWrong = wrongLengths.reduce((sum, length) => sum + length, 0) / wrongLengths.length;
  const allLengths = choices.map((choice) => choice.text.trim().length);
  const overallMax = Math.max(...allLengths);
  const longestCount = allLengths.filter((length) => length === overallMax).length;
  const uniquelyLongestCorrect = maxCorrect === overallMax && longestCount === 1;
  const ratioToMaxWrong = maxCorrect / Math.max(maxWrong, 1);
  const ratioToAvgWrong = maxCorrect / Math.max(avgWrong, 1);

  const exceedsMaxWrong = ratioToMaxWrong > QUIZ_MAX_CORRECT_TO_MAX_WRONG_RATIO;
  const exceedsAvgWrong =
    uniquelyLongestCorrect && ratioToAvgWrong > QUIZ_MAX_CORRECT_TO_AVG_WRONG_RATIO;
  const biased = exceedsMaxWrong || exceedsAvgWrong;

  return {
    biased,
    maxCorrect,
    maxWrong,
    avgWrong,
    ratioToMaxWrong,
    ratioToAvgWrong,
    uniquelyLongestCorrect,
    reason: biased
      ? `theory-quiz correct choice is length-biased (correct=${maxCorrect}, maxWrong=${maxWrong}, avgWrong=${Math.round(avgWrong)}, ratioMax=${ratioToMaxWrong.toFixed(2)}, ratioAvg=${ratioToAvgWrong.toFixed(2)})`
      : undefined,
  };
};

export const collectWikilinks = (text: string): string[] => {
  const links: string[] = [];
  const matcher = new RegExp(WIKILINK_PATTERN.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(text)) !== null) {
    if (match[1] !== undefined) {
      links.push(match[1]);
    }
  }
  return links;
};

const normalize = (value: string): string => value.toLowerCase().replace(/\s+/g, ' ').trim();

const exerciseSolutionText = (exercise: Exercise): string[] => {
  switch (exercise.type) {
    case 'sql-query':
    case 'python-function':
    case 'javascript-function':
      return [exercise.solution];
    case 'fill-in-blanks': {
      const accepts: string[] = [];
      for (const blank of Object.values(exercise.blanks)) {
        for (const candidate of blank.accept ?? []) {
          accepts.push(candidate);
        }
      }
      return accepts;
    }
    case 'git-challenge':
      return exercise.solution;
    default:
      return [];
  }
};

const hasExplanation = (exercise: Exercise): boolean => {
  if (exercise.type === 'theory-quiz') {
    return typeof exercise.explanation === 'string' && exercise.explanation.trim().length > 0;
  }
  return true;
};

const requiresExplanation = (exercise: Exercise): boolean =>
  exercise.type === 'theory-quiz' ||
  exercise.type === 'predict-output' ||
  exercise.type === 'fill-in-blanks';

const lintHints = (scope: string, exercise: Exercise, warnings: LintWarning[]): void => {
  const hints = exercise.hints ?? [];
  const solutions = exerciseSolutionText(exercise)
    .map(normalize)
    .filter((value) => value.length >= 4);
  hints.forEach((hint, index) => {
    const trimmed = hint.trim();
    if (trimmed.length < MIN_HINT_LENGTH) {
      warnings.push({
        scope,
        reason: `hint ${index + 1} is shorter than ${MIN_HINT_LENGTH} characters`,
      });
    }
    const normalizedHint = normalize(trimmed);
    if (solutions.some((solution) => normalizedHint.includes(solution))) {
      warnings.push({
        scope,
        reason: `hint ${index + 1} appears to contain the solution verbatim`,
      });
    }
  });
};

const lintQuizChoiceLengths = (
  scope: string,
  choices: ReadonlyArray<{ id: string; text: string }>,
  correct: ReadonlyArray<string>,
  warnings: LintWarning[],
): void => {
  const report = analyzeQuizChoiceLengths(choices, correct);
  if (report.biased && report.reason) {
    warnings.push({ scope, reason: report.reason });
  }
};

const lintTheoryQuiz = (scope: string, exercise: Exercise, warnings: LintWarning[]): void => {
  if (exercise.type !== 'theory-quiz') {
    return;
  }
  lintQuizChoiceLengths(scope, exercise.choices, exercise.correct, warnings);
  exercise.variants?.forEach((variant, index) => {
    lintQuizChoiceLengths(
      `${scope} [variant ${index + 1}]`,
      variant.choices,
      variant.correct,
      warnings,
    );
  });
};

export const lintExercises = (bundle: TopicBundle): LintWarning[] => {
  const warnings: LintWarning[] = [];
  for (const concept of bundle.concepts) {
    for (const file of concept.exercises) {
      for (const exercise of file.exercises) {
        const scope = `${file.filename} :: ${exercise.id}`;
        if (requiresExplanation(exercise) && !hasExplanation(exercise)) {
          warnings.push({ scope, reason: `${exercise.type} exercise has no explanation` });
        }
        lintHints(scope, exercise, warnings);
        lintTheoryQuiz(scope, exercise, warnings);
      }
    }
  }
  return warnings;
};

export const lintTheoryWikilinks = (bundle: TopicBundle): LintWarning[] => {
  const warnings: LintWarning[] = [];
  const conceptIds = new Set(bundle.manifest.concepts.map((concept) => concept.id));
  for (const concept of bundle.concepts) {
    for (const theory of concept.theory) {
      for (const link of collectWikilinks(theory.source)) {
        if (!conceptIds.has(link)) {
          warnings.push({
            scope: theory.filename,
            reason: `wikilink [[${link}]] does not resolve to a concept in this topic`,
          });
        }
      }
    }
  }
  return warnings;
};

export const lintOverviewPresence = (bundle: TopicBundle): LintWarning[] => {
  const hasOverview = bundle.concepts.some((concept) =>
    concept.theory.some((theory) => /(^|\/)00-overview\./.test(theory.filename)),
  );
  if (hasOverview) {
    return [];
  }
  return [
    {
      scope: bundle.manifest.slug,
      reason: 'topic has no 00-overview theory file',
    },
  ];
};

export const runSoftLint = (bundle: TopicBundle): LintWarning[] => [
  ...lintExercises(bundle),
  ...lintTheoryWikilinks(bundle),
  ...lintOverviewPresence(bundle),
];
