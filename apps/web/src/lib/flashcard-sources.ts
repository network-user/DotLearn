import { db } from '@/lib/progress-db';

import { flashcardTopicSlugs, loadTopicCards, type DeckCard } from './flashcard-decks';
import { interviewFlashcardSlug, loadInterviewCards, type InterviewDeckCard } from './interview-flashcards';

export type FlashcardSource = 'topics' | 'interview';

export interface SessionCard {
  deckSlug: string;
  card: DeckCard;
  source: FlashcardSource;
  sourceLabel: string;
}

export interface FlashcardStats {
  topicDecks: number;
  topicCards: number;
  interviewCards: number;
  totalCards: number;
  due: number;
  reviewed: number;
}

const topicCardToSession = (deckSlug: string, card: DeckCard, sourceLabel: string): SessionCard => ({
  deckSlug,
  card,
  source: 'topics',
  sourceLabel,
});

const interviewCardToSession = (card: InterviewDeckCard): SessionCard => ({
  deckSlug: interviewFlashcardSlug(),
  card,
  source: 'interview',
  sourceLabel: card.categoryLabel,
});

export const loadTopicSessionCards = async (
  slugs: string[],
  language: string,
): Promise<SessionCard[]> => {
  const rows = await Promise.all(
    slugs.map(async (slug) => {
      const cards = await loadTopicCards(slug, language);
      return cards.map((card) => topicCardToSession(slug, card, slug));
    }),
  );
  return rows.flat();
};

export const loadInterviewSessionCards = async (
  language: string,
  filter?: { category?: string; stage?: string },
): Promise<SessionCard[]> => {
  let cards = await loadInterviewCards(language);
  if (filter?.category && filter.category !== 'all') {
    cards = cards.filter((card) => card.category === filter.category);
  }
  if (filter?.stage && filter.stage !== 'all') {
    cards = cards.filter((card) => card.stage === filter.stage);
  }
  return cards.map(interviewCardToSession);
};

export const loadMixedSessionCards = async (
  language: string,
  topicSlugs: string[],
): Promise<SessionCard[]> => {
  const [topicCards, interviewCards] = await Promise.all([
    loadTopicSessionCards(topicSlugs, language),
    loadInterviewSessionCards(language),
  ]);
  return [...topicCards, ...interviewCards];
};

export const shuffleCards = <T,>(input: T[]): T[] => {
  const result = [...input];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap] as T, result[index] as T];
  }
  return result;
};

export const filterDueCards = async (
  cards: SessionCard[],
  now: Date = new Date(),
): Promise<SessionCard[]> => {
  const records = await db.flashcardReviews.toArray();
  const byKey = new Map(records.map((record) => [`${record.topicSlug}:${record.cardId}`, record]));
  const nowMs = now.getTime();
  return cards.filter((entry) => {
    const record = byKey.get(`${entry.deckSlug}:${entry.card.id}`);
    return !record || new Date(record.due).getTime() <= nowMs;
  });
};

export const loadFlashcardStats = async (language: string): Promise<FlashcardStats> => {
  const slugs = flashcardTopicSlugs();
  const [topicBundles, interviewCards, records] = await Promise.all([
    Promise.all(
      slugs.map(async (slug) => {
        try {
          const cards = await loadTopicCards(slug, language);
          return cards.length > 0 ? { slug, count: cards.length } : undefined;
        } catch {
          return undefined;
        }
      }),
    ),
    loadInterviewCards(language),
    db.flashcardReviews.toArray(),
  ]);
  const activeDecks = topicBundles.filter(
    (entry): entry is { slug: string; count: number } => entry !== undefined,
  );
  const topicCards = activeDecks.reduce((sum, entry) => sum + entry.count, 0);
  const nowMs = Date.now();
  const due = records.filter((record) => new Date(record.due).getTime() <= nowMs).length;
  return {
    topicDecks: activeDecks.length,
    topicCards,
    interviewCards: interviewCards.length,
    totalCards: topicCards + interviewCards.length,
    due,
    reviewed: records.length,
  };
};
