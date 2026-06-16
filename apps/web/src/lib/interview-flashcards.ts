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

interface FlashcardsIndex {
  generatedAt: string;
  ru: FlashcardsIndexLocale;
  en: FlashcardsIndexLocale;
}

const indexModules = import.meta.glob<{ default: FlashcardsIndex }>(
  '../../../../interview/flashcards-index.json',
  { eager: true },
);

const rawIndex = Object.values(indexModules)[0]?.default;

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

const cardsForLocale = (locale: string): InterviewDeckCard[] => {
  if (!rawIndex) return [];
  const bundle = locale === 'en' ? rawIndex.en : rawIndex.ru;
  return bundle.cards.map(cardFromEntry);
};

const missingForLocale = (locale: string): FlashcardsIndexLocale['missing'] => {
  if (!rawIndex) return [];
  const bundle = locale === 'en' ? rawIndex.en : rawIndex.ru;
  return bundle.missing;
};

export const interviewFlashcardSlug = (): string => INTERVIEW_TOPIC_SLUG;

export const loadInterviewCards = async (locale: string): Promise<InterviewDeckCard[]> =>
  cardsForLocale(locale);

export const loadInterviewCardsByCategory = async (
  category: string,
  locale: string,
): Promise<InterviewDeckCard[]> => {
  const all = await loadInterviewCards(locale);
  return all.filter((card) => card.category === category);
};

export const interviewFlashcardCoverage = (
  locale: string,
): { cards: number; missing: number; missingPaths: string[] } => {
  const missing = missingForLocale(locale);
  const cards = cardsForLocale(locale);
  return {
    cards: cards.length,
    missing: missing.length,
    missingPaths: missing.map((entry) => entry.path),
  };
};
