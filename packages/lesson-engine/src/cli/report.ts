import { exerciseVariantCount, type Exercise } from '@dotlearn/contracts';

import type { TopicBundle } from '../loader/source';
import { classifyRuntimeForSandbox, parseTheoryFrontmatter } from './theory-lint';
import { languageOfFile } from './structural-gates';

export interface ConceptReport {
  conceptId: string;
  distinctExercises: number;
  totalVariants: number;
  figureCount: number;
  theoryWordCount: number;
  hasSandbox: boolean;
}

export interface TopicReport {
  slug: string;
  title: string;
  languages: string[];
  primaryLanguage: string;
  runtime: string;
  difficulty: string;
  prerequisites: string[];
  conceptCount: number;
  exerciseCount: number;
  exercisesPerConcept: number;
  difficultyHistogram: Record<string, number>;
  typeMix: Record<string, number>;
  figureCount: number;
  theoryWordCount: number;
  theoryWordBudget: { min: number; max: number; withinBudget: boolean };
  flashcardCount: number;
  concepts: ConceptReport[];
}

const THEORY_WORD_MIN = 1200;
const THEORY_WORD_MAX = 2000;

const countWords = (text: string): number => {
  const stripped = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  const matches = stripped.match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu);
  return matches ? matches.length : 0;
};

const countFigures = (body: string): number => {
  const matcher = /<Figure\b/g;
  let count = 0;
  while (matcher.exec(body) !== null) {
    count += 1;
  }
  return count;
};

const distinctExercises = (bundle: TopicBundle): Exercise[] => {
  const seen = new Map<string, Exercise>();
  for (const concept of bundle.concepts) {
    for (const file of concept.exercises) {
      for (const exercise of file.exercises) {
        const key = `${concept.conceptId}/${exercise.id}`;
        if (!seen.has(key)) {
          seen.set(key, exercise);
        }
      }
    }
  }
  return [...seen.values()];
};

export const buildTopicReport = (bundle: TopicBundle, flashcardCount: number): TopicReport => {
  const runtimeClass = classifyRuntimeForSandbox(bundle.manifest.runtime);
  const primaryLanguage = bundle.manifest.primaryLanguage;

  const concepts: ConceptReport[] = bundle.concepts.map((concept) => {
    const distinct = new Map<string, Exercise>();
    for (const file of concept.exercises) {
      for (const exercise of file.exercises) {
        if (!distinct.has(exercise.id)) {
          distinct.set(exercise.id, exercise);
        }
      }
    }
    const exercises = [...distinct.values()];
    const primaryTheory =
      concept.theory.find((theory) => languageOfFile(theory.filename) === primaryLanguage) ??
      concept.theory[0];
    const body = primaryTheory ? parseTheoryFrontmatter(primaryTheory.source).body : '';
    const sandboxPresent =
      runtimeClass === 'other'
        ? true
        : runtimeClass === 'python'
          ? /<PyDemo\b/.test(body)
          : /<SideSql\b/.test(body);
    return {
      conceptId: concept.conceptId,
      distinctExercises: exercises.length,
      totalVariants: exercises.reduce((sum, exercise) => sum + exerciseVariantCount(exercise), 0),
      figureCount: countFigures(body),
      theoryWordCount: countWords(body),
      hasSandbox: sandboxPresent,
    };
  });

  const exercises = distinctExercises(bundle);
  const difficultyHistogram: Record<string, number> = {};
  const typeMix: Record<string, number> = {};
  for (const exercise of exercises) {
    const difficultyKey = String(exercise.difficulty);
    difficultyHistogram[difficultyKey] = (difficultyHistogram[difficultyKey] ?? 0) + 1;
    typeMix[exercise.type] = (typeMix[exercise.type] ?? 0) + 1;
  }

  const conceptCount = bundle.concepts.length;
  const exerciseCount = exercises.length;
  const theoryWordCount = concepts.reduce((sum, concept) => sum + concept.theoryWordCount, 0);
  const figureCount = concepts.reduce((sum, concept) => sum + concept.figureCount, 0);

  return {
    slug: bundle.manifest.slug,
    title: bundle.manifest.title,
    languages: [...bundle.manifest.availableLanguages],
    primaryLanguage,
    runtime: bundle.manifest.runtime,
    difficulty: bundle.manifest.difficulty,
    prerequisites: [...bundle.manifest.prerequisites],
    conceptCount,
    exerciseCount,
    exercisesPerConcept:
      conceptCount === 0 ? 0 : Math.round((exerciseCount / conceptCount) * 100) / 100,
    difficultyHistogram,
    typeMix,
    figureCount,
    theoryWordCount,
    theoryWordBudget: {
      min: THEORY_WORD_MIN,
      max: THEORY_WORD_MAX,
      withinBudget: theoryWordCount >= THEORY_WORD_MIN && theoryWordCount <= THEORY_WORD_MAX,
    },
    flashcardCount,
    concepts,
  };
};

export const formatTopicReport = (report: TopicReport): string => {
  const lines: string[] = [];
  lines.push(`# ${report.slug} — ${report.title}`);
  lines.push(
    `  languages: ${report.languages.join(', ')} (primary ${report.primaryLanguage}) | runtime: ${report.runtime} | difficulty: ${report.difficulty}`,
  );
  lines.push(
    `  concepts: ${report.conceptCount} | exercises: ${report.exerciseCount} (${report.exercisesPerConcept}/concept) | flashcards: ${report.flashcardCount} | figures: ${report.figureCount}`,
  );
  const histogram = Object.keys(report.difficultyHistogram)
    .sort()
    .map((key) => `${key}:${report.difficultyHistogram[key]}`)
    .join(' ');
  lines.push(`  difficulty histogram: ${histogram || '(none)'}`);
  const types = Object.keys(report.typeMix)
    .sort()
    .map((key) => `${key}:${report.typeMix[key]}`)
    .join(' ');
  lines.push(`  type mix: ${types || '(none)'}`);
  const budgetFlag = report.theoryWordBudget.withinBudget ? 'within budget' : 'OUT OF BUDGET';
  lines.push(
    `  theory words: ${report.theoryWordCount} (budget ${report.theoryWordBudget.min}-${report.theoryWordBudget.max}, ${budgetFlag})`,
  );
  lines.push(`  prerequisites: ${report.prerequisites.join(', ') || '(none)'}`);
  return lines.join('\n');
};
