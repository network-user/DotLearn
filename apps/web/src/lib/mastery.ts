import { useMemo } from 'react';

import { useLiveQuery } from 'dexie-react-hooks';

import { db } from './progress-db';

export interface TopicMastery {
  readConcepts: number;
  totalConcepts: number;
  passedExercises: number;
  totalExercises: number;
  readingRatio: number;
  solvingRatio: number;
  mastery: number;
}

export interface BlendedMastery extends TopicMastery {
  recall: number;
  hasRecall: boolean;
  blendedMastery: number;
  needsReview: boolean;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const RECALL_WEIGHT = 0.35;
export const RECALL_REVIEW_THRESHOLD = 0.7;

export const computeMastery = (
  readConcepts: number,
  totalConcepts: number,
  passedExercises: number,
  totalExercises: number,
): TopicMastery => {
  const readingRatio = totalConcepts === 0 ? 0 : clamp01(readConcepts / totalConcepts);
  const solvingRatio = totalExercises === 0 ? 0 : clamp01(passedExercises / totalExercises);
  const mastery = totalExercises === 0 ? readingRatio : 0.5 * readingRatio + 0.5 * solvingRatio;
  return {
    readConcepts,
    totalConcepts,
    passedExercises,
    totalExercises,
    readingRatio,
    solvingRatio,
    mastery,
  };
};

export const blendRecallIntoMastery = (
  base: TopicMastery,
  recall: number | undefined,
  reviewThreshold = RECALL_REVIEW_THRESHOLD,
): BlendedMastery => {
  const hasRecall = recall !== undefined && Number.isFinite(recall);
  const safeRecall = hasRecall ? clamp01(recall as number) : 1;
  const blendedMastery = hasRecall
    ? clamp01((1 - RECALL_WEIGHT) * base.mastery + RECALL_WEIGHT * base.mastery * safeRecall)
    : base.mastery;
  const wasMastered = base.mastery >= 0.999;
  const needsReview = hasRecall && wasMastered && safeRecall < reviewThreshold;
  return {
    ...base,
    recall: safeRecall,
    hasRecall,
    blendedMastery,
    needsReview,
  };
};

export const useReadConceptsByTopic = (): Map<string, Set<string>> => {
  const records = useLiveQuery(() => db.conceptRead.toArray(), [], []);
  return useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const record of records ?? []) {
      const set = map.get(record.topicSlug) ?? new Set<string>();
      set.add(record.conceptId);
      map.set(record.topicSlug, set);
    }
    return map;
  }, [records]);
};

export const countReadConcepts = (
  conceptIds: readonly { id: string }[],
  readSet: Set<string> | undefined,
): number => {
  if (!readSet) return 0;
  let count = 0;
  for (const concept of conceptIds) {
    if (readSet.has(concept.id)) count += 1;
  }
  return count;
};
