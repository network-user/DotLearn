import type { InterviewQuestionMeta } from '@dotlearn/contracts';

import { extractInterviewAnswer } from '@/lib/interview-flashcard-text';
import {
  interviewQuestions,
  localizedInterviewTitle,
} from '@/lib/interview';
import { INTERVIEW_TOPIC_SLUG } from '@/lib/progress-db';

import type { DeckCard } from './flashcard-decks';

export interface InterviewDeckCard extends DeckCard {
  questionId: number;
  category: string;
  categoryLabel: string;
  stage: string;
}

const mdxRawModules = import.meta.glob<string>('../../../../interview/*/*.mdx', {
  query: '?raw',
  import: 'default',
});

const MDX_PREFIX = '../../../../interview/';

const rawByPath = new Map<string, () => Promise<string>>();
for (const [rawPath, load] of Object.entries(mdxRawModules)) {
  const key = rawPath.startsWith(MDX_PREFIX) ? rawPath.slice(MDX_PREFIX.length) : rawPath;
  rawByPath.set(key, load as () => Promise<string>);
}

const cardCache = new Map<string, Promise<InterviewDeckCard[]>>();

const articlePathFor = (question: InterviewQuestionMeta, locale: string): string => {
  if (locale === 'en') {
    const enPath = question.path.replace(/\.ru\.mdx$/, '.en.mdx');
    if (rawByPath.has(enPath)) return enPath;
  }
  return question.path;
};

const cardFromQuestion = async (
  question: InterviewQuestionMeta,
  locale: string,
): Promise<InterviewDeckCard | undefined> => {
  const path = articlePathFor(question, locale);
  const load = rawByPath.get(path);
  if (!load) return undefined;
  const raw = await load();
  const back = extractInterviewAnswer(raw);
  if (!back) return undefined;
  const front = localizedInterviewTitle(question, locale);
  return {
    id: `q-${question.id}`,
    front,
    back,
    conceptId: question.category,
    tags: [question.category, question.stage],
    questionId: question.id,
    category: question.category,
    categoryLabel: question.categoryLabel,
    stage: question.stage,
  };
};

export const interviewFlashcardSlug = (): string => INTERVIEW_TOPIC_SLUG;

export const loadInterviewCards = async (locale: string): Promise<InterviewDeckCard[]> => {
  const cacheKey = locale;
  const cached = cardCache.get(cacheKey);
  if (cached) return cached;
  const pending = Promise.all(
    interviewQuestions.map((question) => cardFromQuestion(question, locale)),
  ).then((cards) => cards.filter((card): card is InterviewDeckCard => card !== undefined));
  cardCache.set(cacheKey, pending);
  return pending;
};

export const loadInterviewCardsByCategory = async (
  category: string,
  locale: string,
): Promise<InterviewDeckCard[]> => {
  const all = await loadInterviewCards(locale);
  return all.filter((card) => card.category === category);
};
