import type { Exercise } from '@dotlearn/contracts';

import type { TopicBundle } from '../loader/source';

export interface LintWarning {
  scope: string;
  reason: string;
}

const WIKILINK_PATTERN = /\[\[([a-z0-9][a-z0-9-]*)\]\]/g;
const MIN_HINT_LENGTH = 15;

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
