import { useMemo } from 'react';

import { useLiveQuery } from 'dexie-react-hooks';
import { forgetting_curve, State } from 'ts-fsrs';

import { db, type FlashcardReviewRecord } from './progress-db';

export interface TopicRecall {
  recall: number;
  reviewedCards: number;
  dueCards: number;
}

const MS_PER_DAY = 86_400_000;

const elapsedDaysSince = (lastReviewAt: string | undefined, now: Date): number => {
  if (!lastReviewAt) return 0;
  const last = new Date(lastReviewAt).getTime();
  if (!Number.isFinite(last)) return 0;
  return Math.max(0, (now.getTime() - last) / MS_PER_DAY);
};

export const cardRetrievability = (record: FlashcardReviewRecord, now: Date): number => {
  if (record.state === State.New || record.stability <= 0) return 0;
  const elapsed = elapsedDaysSince(record.lastReviewAt, now);
  const value = forgetting_curve(elapsed, record.stability);
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
};

export const topicRecallFromRecords = (
  records: readonly FlashcardReviewRecord[],
  now: Date = new Date(),
): TopicRecall => {
  const reviewed = records.filter((record) => record.state !== State.New);
  if (reviewed.length === 0) {
    return { recall: 1, reviewedCards: 0, dueCards: 0 };
  }
  const isoNow = now.toISOString();
  let sum = 0;
  let dueCards = 0;
  for (const record of reviewed) {
    sum += cardRetrievability(record, now);
    if (record.due <= isoNow) dueCards += 1;
  }
  return {
    recall: sum / reviewed.length,
    reviewedCards: reviewed.length,
    dueCards,
  };
};

export const recallByTopicFromRecords = (
  records: readonly FlashcardReviewRecord[],
  now: Date = new Date(),
): Map<string, TopicRecall> => {
  const byTopic = new Map<string, FlashcardReviewRecord[]>();
  for (const record of records) {
    const bucket = byTopic.get(record.topicSlug) ?? [];
    bucket.push(record);
    byTopic.set(record.topicSlug, bucket);
  }
  const out = new Map<string, TopicRecall>();
  for (const [topicSlug, bucket] of byTopic) {
    out.set(topicSlug, topicRecallFromRecords(bucket, now));
  }
  return out;
};

export const useRecallByTopic = (): Map<string, TopicRecall> => {
  const records = useLiveQuery(() => db.flashcardReviews.toArray(), [], []);
  return useMemo(() => recallByTopicFromRecords(records ?? []), [records]);
};
