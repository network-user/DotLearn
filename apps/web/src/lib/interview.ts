import { lazy, type ComponentType } from 'react';

import {
  ExerciseFile,
  parseInterviewExercisesIndex,
  parseInterviewIndex,
  type Exercise,
  type InterviewCategory,
  type InterviewExerciseMeta,
  type InterviewQuestionMeta,
  type InterviewStage,
} from '@dotlearn/contracts';

const indexModules = import.meta.glob<{ default: unknown }>(
  '../../../../interview/index.json',
  { eager: true },
);

const rawIndex = Object.values(indexModules)[0]?.default ?? [];

export const interviewQuestions: InterviewQuestionMeta[] = parseInterviewIndex(rawIndex);

const byId = new Map<number, InterviewQuestionMeta>();
for (const question of interviewQuestions) {
  byId.set(question.id, question);
}

export interface CategoryInfo {
  slug: InterviewCategory;
  label: string;
  count: number;
}

export interface StageInfo {
  slug: InterviewStage;
  label: string;
  count: number;
}

const buildFacets = <T extends string>(
  pick: (q: InterviewQuestionMeta) => { slug: T; label: string },
): { slug: T; label: string; count: number }[] => {
  const map = new Map<T, { slug: T; label: string; count: number }>();
  for (const question of interviewQuestions) {
    const { slug, label } = pick(question);
    const existing = map.get(slug);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(slug, { slug, label, count: 1 });
    }
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'ru'));
};

export const interviewCategories: CategoryInfo[] = buildFacets((q) => ({
  slug: q.category,
  label: q.categoryLabel,
}));

const STAGE_ORDER: InterviewStage[] = ['hr', 'tech', 'system-design'];

export const interviewStages: StageInfo[] = buildFacets((q) => ({
  slug: q.stage,
  label: q.stageLabel,
})).sort((a, b) => STAGE_ORDER.indexOf(a.slug) - STAGE_ORDER.indexOf(b.slug));

export const getInterviewQuestion = (id: number): InterviewQuestionMeta | undefined =>
  byId.get(id);

export const interviewTitleOf = (id: number): string | undefined => byId.get(id)?.title;

export const relatedInterviewQuestions = (
  question: InterviewQuestionMeta,
  limit = 6,
): InterviewQuestionMeta[] =>
  interviewQuestions
    .filter((other) => other.category === question.category && other.id !== question.id)
    .slice(0, limit);

interface MdxModule {
  default: ComponentType<Record<string, unknown>>;
}

const mdxImporters = import.meta.glob<MdxModule>('../../../../interview/*/*.mdx');

const MDX_PREFIX = '../../../../interview/';

const importerByPath = new Map<string, () => Promise<MdxModule>>();
for (const [rawPath, importer] of Object.entries(mdxImporters)) {
  const key = rawPath.startsWith(MDX_PREFIX) ? rawPath.slice(MDX_PREFIX.length) : rawPath;
  importerByPath.set(key, importer);
}

const componentCache = new Map<string, ComponentType<Record<string, unknown>>>();

export const getInterviewComponent = (
  path: string,
): ComponentType<Record<string, unknown>> | undefined => {
  const importer = importerByPath.get(path);
  if (!importer) {
    return undefined;
  }
  let Component = componentCache.get(path);
  if (!Component) {
    Component = lazy(importer);
    componentCache.set(path, Component);
  }
  return Component;
};

export const localizedInterviewTitle = (
  question: InterviewQuestionMeta,
  locale: string,
): string => (locale === 'en' && question.titleEn ? question.titleEn : question.title);

export const getInterviewComponentForLocale = (
  question: InterviewQuestionMeta,
  locale: string,
): ComponentType<Record<string, unknown>> | undefined => {
  if (locale === 'en') {
    const enComponent = getInterviewComponent(question.path.replace(/\.ru\.mdx$/, '.en.mdx'));
    if (enComponent) return enComponent;
  }
  return getInterviewComponent(question.path);
};

const exerciseIndexModules = import.meta.glob<{ default: unknown }>(
  '../../../../interview/exercises-index.json',
  { eager: true },
);

const rawExerciseIndex = Object.values(exerciseIndexModules)[0]?.default ?? [];

export const interviewExercises: InterviewExerciseMeta[] =
  parseInterviewExercisesIndex(rawExerciseIndex);

const exerciseFileImporters = import.meta.glob<{ default: unknown }>(
  '../../../../interview/*/*.exercises.json',
);

const exerciseImporterByPath = new Map<string, () => Promise<{ default: unknown }>>();
for (const [rawPath, importer] of Object.entries(exerciseFileImporters)) {
  const key = rawPath.startsWith(MDX_PREFIX) ? rawPath.slice(MDX_PREFIX.length) : rawPath;
  exerciseImporterByPath.set(key, importer);
}

const exerciseFileCache = new Map<string, Promise<Exercise[]>>();

const loadExerciseFile = (exercisesPath: string): Promise<Exercise[]> => {
  const cached = exerciseFileCache.get(exercisesPath);
  if (cached) return cached;
  const importer = exerciseImporterByPath.get(exercisesPath);
  if (!importer) {
    return Promise.resolve([]);
  }
  const pending = importer()
    .then((mod) => ExerciseFile.parse(mod.default).exercises)
    .catch(() => [] as Exercise[]);
  exerciseFileCache.set(exercisesPath, pending);
  return pending;
};

const exercisesPathOfQuestion = (questionPath: string): string =>
  questionPath.replace(/\.ru\.mdx$/, '.exercises.json');

export const loadQuestionExercises = (question: InterviewQuestionMeta): Promise<Exercise[]> =>
  question.exerciseCount > 0
    ? loadExerciseFile(exercisesPathOfQuestion(question.path))
    : Promise.resolve([]);

export const loadExerciseById = async (
  meta: InterviewExerciseMeta,
): Promise<Exercise | undefined> => {
  const list = await loadExerciseFile(meta.path);
  return list.find((exercise) => exercise.id === meta.exerciseId);
};

export const interviewExerciseTypes: string[] = [
  ...new Set(interviewExercises.map((meta) => meta.type)),
].sort();

export const interviewDifficulties: number[] = [
  ...new Set(interviewExercises.map((meta) => meta.difficulty)),
].sort((a, b) => a - b);
