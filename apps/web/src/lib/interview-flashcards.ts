import { INTERVIEW_TOPIC_SLUG } from '@/lib/progress-db';

import type { DeckCard } from './flashcard-decks';

export interface InterviewDeckCard extends DeckCard {
  questionId: number;
  category: string;
  categoryLabel: string;
  stage: string;
}

interface FlashcardIndexEntry {
  questionId: number;
  category: string;
  categoryLabel: string;
  stage: string;
  front: string;
  back: string;
  path: string;
}

interface FlashcardsIndexLocale {
  cards: FlashcardIndexEntry[];
  missing: { questionId: number; path: string; locale: string; reason: string }[];
}

const ruIndexModules = import.meta.glob<{ default: FlashcardsIndexLocale }>(
  '../../../../interview/flashcards-index.ru.json',
);
const enIndexModules = import.meta.glob<{ default: FlashcardsIndexLocale }>(
  '../../../../interview/flashcards-index.en.json',
);

const localeCache = new Map<'ru' | 'en', FlashcardsIndexLocale>();

const loadLocaleIndex = async (locale: string): Promise<FlashcardsIndexLocale> => {
  const key: 'ru' | 'en' = locale === 'en' ? 'en' : 'ru';
  const cached = localeCache.get(key);
  if (cached) return cached;
  const modules = key === 'en' ? enIndexModules : ruIndexModules;
  const loader = Object.values(modules)[0];
  const data = loader ? (await loader()).default : { cards: [], missing: [] };
  localeCache.set(key, data);
  return data;
};

const cardFromEntry = (entry: FlashcardIndexEntry): InterviewDeckCard => ({
  id: `q-${entry.questionId}`,
  front: entry.front,
  back: entry.back,
  conceptId: entry.category,
  tags: [entry.category, entry.stage],
  questionId: entry.questionId,
  category: entry.category,
  categoryLabel: entry.categoryLabel,
  stage: entry.stage,
});

export const interviewFlashcardSlug = (): string => INTERVIEW_TOPIC_SLUG;

export const loadInterviewCards = async (locale: string): Promise<InterviewDeckCard[]> => {
  const index = await loadLocaleIndex(locale);
  return index.cards.map(cardFromEntry);
};

export const loadInterviewCardsByCategory = async (
  category: string,
  locale: string,
): Promise<InterviewDeckCard[]> => {
  const all = await loadInterviewCards(locale);
  return all.filter((card) => card.category === category);
};

export interface InterviewFlashcardCoverage {
  cards: number;
  missing: number;
  missingPaths: string[];
}

export const interviewFlashcardCoverage = async (
  locale: string,
): Promise<InterviewFlashcardCoverage> => {
  const index = await loadLocaleIndex(locale);
  return {
    cards: index.cards.length,
    missing: index.missing.length,
    missingPaths: index.missing.map((entry) => entry.path),
  };
};
