import { lazy, type ComponentType } from 'react';

import {
  parseInterviewIndex,
  type InterviewCategory,
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
