import { createEmptyCard, fsrs, generatorParameters, Rating, type Card, type Grade } from 'ts-fsrs';

import { db, type FlashcardReviewRecord } from './progress-db';

const scheduler = fsrs(generatorParameters());

const toRecord = (
  topicSlug: string,
  cardId: string,
  card: Card,
  lastReviewAt: string | undefined,
): FlashcardReviewRecord => ({
  id: `${topicSlug}:${cardId}`,
  topicSlug,
  cardId,
  due: card.due.toISOString(),
  stability: card.stability,
  difficulty: card.difficulty,
  elapsedDays: card.elapsed_days,
  scheduledDays: card.scheduled_days,
  reps: card.reps,
  lapses: card.lapses,
  state: card.state,
  ...(lastReviewAt !== undefined ? { lastReviewAt } : {}),
});

const toCard = (record: FlashcardReviewRecord): Card => {
  const base = {
    due: new Date(record.due),
    stability: record.stability,
    difficulty: record.difficulty,
    elapsed_days: record.elapsedDays,
    scheduled_days: record.scheduledDays,
    reps: record.reps,
    lapses: record.lapses,
    state: record.state,
  };
  return record.lastReviewAt
    ? ({ ...base, last_review: new Date(record.lastReviewAt) } as Card)
    : (base as Card);
};

export const initFlashcardReview = async (
  topicSlug: string,
  cardId: string,
): Promise<FlashcardReviewRecord> => {
  const id = `${topicSlug}:${cardId}`;
  const existing = await db.flashcardReviews.get(id);
  if (existing) {
    return existing;
  }
  const card = createEmptyCard(new Date());
  const record = toRecord(topicSlug, cardId, card, undefined);
  await db.flashcardReviews.put(record);
  return record;
};

export type FlashcardRating = 'again' | 'hard' | 'good' | 'easy';

const RATING_MAP: Record<FlashcardRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

export const reviewFlashcard = async (
  topicSlug: string,
  cardId: string,
  rating: FlashcardRating,
  now: Date = new Date(),
): Promise<FlashcardReviewRecord> => {
  const id = `${topicSlug}:${cardId}`;
  const existing = await db.flashcardReviews.get(id);
  const card = existing ? toCard(existing) : createEmptyCard(now);
  const item = scheduler.next(card, now, RATING_MAP[rating]);
  const record = toRecord(topicSlug, cardId, item.card, now.toISOString());
  await db.flashcardReviews.put(record);
  return record;
};

export const dueFlashcards = async (
  topicSlug: string,
  now: Date = new Date(),
): Promise<FlashcardReviewRecord[]> => {
  const isoNow = now.toISOString();
  return db.flashcardReviews
    .where('topicSlug')
    .equals(topicSlug)
    .filter((record) => record.due <= isoNow)
    .toArray();
};
