import { isCardDue } from '@dotlearn/lesson-engine';

import { db, USER_CARDS_DECK_SLUG, type UserCardRecord } from '@/lib/progress-db';

import { flashcardTopicSlugs, loadTopicCards, type DeckCard } from './flashcard-decks';
import {
  interviewFlashcardSlug,
  loadInterviewCards,
  type InterviewDeckCard,
} from './interview-flashcards';

export type FlashcardSource = 'topics' | 'interview' | 'user';

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

const topicCardToSession = (
  deckSlug: string,
  card: DeckCard,
  sourceLabel: string,
): SessionCard => ({
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

const userCardToSession = (record: UserCardRecord, sourceLabel: string): SessionCard => ({
  deckSlug: USER_CARDS_DECK_SLUG,
  card: {
    id: record.id,
    front: record.front,
    back: record.back,
    conceptId: record.conceptId ?? record.topicSlug,
  },
  source: 'user',
  sourceLabel,
});

export const loadUserCardSessionCards = async (
  resolveLabel: (record: UserCardRecord) => string,
): Promise<SessionCard[]> => {
  const records = await db.userCards.orderBy('createdAt').reverse().toArray();
  return records.map((record) => userCardToSession(record, resolveLabel(record)));
};

export const countDueUserCards = async (now: Date = new Date()): Promise<number> => {
  const [records, reviews] = await Promise.all([
    db.userCards.toArray(),
    db.flashcardReviews.where('topicSlug').equals(USER_CARDS_DECK_SLUG).toArray(),
  ]);
  const byKey = new Map(reviews.map((review) => [review.cardId, review]));
  return records.filter((record) => isCardDue(byKey.get(record.id), now)).length;
};

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

export const shuffleCards = <T>(input: T[]): T[] => {
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
  const slugs = [...new Set(cards.map((entry) => entry.deckSlug))];
  const records = await db.flashcardReviews.where('topicSlug').anyOf(slugs).toArray();
  const byKey = new Map(records.map((record) => [`${record.topicSlug}:${record.cardId}`, record]));
  return cards.filter((entry) => isCardDue(byKey.get(`${entry.deckSlug}:${entry.card.id}`), now));
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
  const now = new Date();
  const due = records.filter((record) => isCardDue(record, now)).length;
  return {
    topicDecks: activeDecks.length,
    topicCards,
    interviewCards: interviewCards.length,
    totalCards: topicCards + interviewCards.length,
    due,
    reviewed: records.length,
  };
};
