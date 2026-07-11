import { lazy, type ComponentType } from 'react';

import {
  ExerciseFile,
  parseInterviewExercisesIndex,
  parseInterviewIndex,
  type Exercise,
  type InterviewCategory,
  type InterviewExerciseMeta,
  type InterviewQuestionMeta,
  type InterviewRelatedTopic,
  type InterviewStage,
} from '@dotlearn/contracts';

const indexModules = import.meta.glob<{ default: unknown }>('../../../../interview/index.json', {
  eager: true,
});

const rawIndex = Object.values(indexModules)[0]?.default ?? [];

let interviewIndexCache: InterviewQuestionMeta[] | undefined;

export const getInterviewIndex = (): InterviewQuestionMeta[] => {
  if (!interviewIndexCache) {
    interviewIndexCache = parseInterviewIndex(rawIndex);
  }
  return interviewIndexCache;
};

let interviewByIdCache: Map<number, InterviewQuestionMeta> | undefined;

const getInterviewByIdMap = (): Map<number, InterviewQuestionMeta> => {
  if (!interviewByIdCache) {
    const map = new Map<number, InterviewQuestionMeta>();
    for (const question of getInterviewIndex()) {
      map.set(question.id, question);
    }
    interviewByIdCache = map;
  }
  return interviewByIdCache;
};

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
  for (const question of getInterviewIndex()) {
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

let interviewCategoriesCache: CategoryInfo[] | undefined;

export const getInterviewCategories = (): CategoryInfo[] => {
  if (!interviewCategoriesCache) {
    interviewCategoriesCache = buildFacets((q) => ({
      slug: q.category,
      label: q.categoryLabel,
    }));
  }
  return interviewCategoriesCache;
};

const STAGE_ORDER: InterviewStage[] = ['hr', 'tech', 'system-design'];

let interviewStagesCache: StageInfo[] | undefined;

export const getInterviewStages = (): StageInfo[] => {
  if (!interviewStagesCache) {
    interviewStagesCache = buildFacets((q) => ({
      slug: q.stage,
      label: q.stageLabel,
    })).sort((a, b) => STAGE_ORDER.indexOf(a.slug) - STAGE_ORDER.indexOf(b.slug));
  }
  return interviewStagesCache;
};

export const getInterviewQuestion = (id: number): InterviewQuestionMeta | undefined =>
  getInterviewByIdMap().get(id);

export const interviewTitleOf = (id: number): string | undefined =>
  getInterviewByIdMap().get(id)?.title;

const STOP_WORDS = new Set([
  'и',
  'в',
  'во',
  'не',
  'на',
  'с',
  'со',
  'по',
  'из',
  'за',
  'к',
  'о',
  'об',
  'от',
  'для',
  'что',
  'как',
  'это',
  'или',
  'the',
  'a',
  'an',
  'of',
  'to',
  'in',
  'is',
  'and',
  'for',
]);

const titleKeywords = (title: string): Set<string> => {
  const words = title
    .toLowerCase()
    .replace(/[«»"'`?.,:;!()]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
  return new Set(words);
};

export const relatedInterviewQuestions = (
  question: InterviewQuestionMeta,
  limit = 6,
): InterviewQuestionMeta[] => {
  const keywords = titleKeywords(question.title);
  const candidates = getInterviewIndex().filter(
    (other) => other.category === question.category && other.id !== question.id,
  );
  const scored = candidates.map((other) => {
    const otherKeywords = titleKeywords(other.title);
    let overlap = 0;
    for (const word of otherKeywords) {
      if (keywords.has(word)) overlap += 1;
    }
    const stageBonus = other.stage === question.stage ? 1 : 0;
    return { other, score: overlap * 2 + stageBonus };
  });
  scored.sort((a, b) => b.score - a.score || a.other.id - b.other.id);
  return scored.slice(0, limit).map((entry) => entry.other);
};

const categoryTopicSlugs: Record<string, string[]> = {
  'data-storage': ['sql-fundamentals', 'database-types', 'python-orm', 'django-query-profiling'],
  concurrency: ['python-storage-internals', 'celery', 'message-brokers'],
  'web-networking': ['cors', 'websockets-realtime', 'fastapi', 'keycloak'],
  'oop-patterns': ['python-oop', 'clean-architecture', 'dependency-injection'],
  'python-core': [
    'python-decorators',
    'python-mro',
    'python-context-managers',
    'python-typevar',
    'python-walrus',
    'python-main-guard',
  ],
  'data-structures': ['python-algorithms', 'computational-complexity'],
  infrastructure: ['git', 'celery', 'message-brokers'],
  frameworks: ['fastapi', 'python-orm', 'django-query-profiling'],
  'quality-process': ['clean-architecture', 'python-logging', 'computational-complexity'],
  'system-design': ['clean-architecture', 'message-brokers', 'database-types'],
};

export const relatedTopicsForQuestion = (
  question: InterviewQuestionMeta,
): InterviewRelatedTopic[] => {
  if (question.relatedTopics && question.relatedTopics.length > 0) {
    return question.relatedTopics;
  }
  const slugs = categoryTopicSlugs[question.category] ?? [];
  return slugs.map((slug) => ({ slug }));
};

export const topicSlugsForCategory = (category: InterviewCategory): string[] =>
  categoryTopicSlugs[category] ?? [];

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

export const localizedInterviewTitle = (question: InterviewQuestionMeta, locale: string): string =>
  locale === 'en' && question.titleEn ? question.titleEn : question.title;

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

let interviewExercisesCache: InterviewExerciseMeta[] | undefined;

export const getInterviewExercisesIndex = (): InterviewExerciseMeta[] => {
  if (!interviewExercisesCache) {
    interviewExercisesCache = parseInterviewExercisesIndex(rawExerciseIndex);
  }
  return interviewExercisesCache;
};

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

let interviewExerciseTypesCache: string[] | undefined;

export const getInterviewExerciseTypes = (): string[] => {
  if (!interviewExerciseTypesCache) {
    interviewExerciseTypesCache = [
      ...new Set(getInterviewExercisesIndex().map((meta) => meta.type)),
    ].sort();
  }
  return interviewExerciseTypesCache;
};

let interviewDifficultiesCache: number[] | undefined;

export const getInterviewDifficulties = (): number[] => {
  if (!interviewDifficultiesCache) {
    interviewDifficultiesCache = [
      ...new Set(getInterviewExercisesIndex().map((meta) => meta.difficulty)),
    ].sort((a, b) => a - b);
  }
  return interviewDifficultiesCache;
};
