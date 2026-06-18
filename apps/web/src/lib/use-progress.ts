import { useMemo } from 'react';

import { useLiveQuery } from 'dexie-react-hooks';

import {
  db,
  localDayKey,
  type ActivityRecord,
  type ProgressRecord,
  type ProgressStatus,
} from './progress-db';

export interface TopicProgress {
  byExercise: Map<string, ProgressRecord>;
  passed: number;
  failed: number;
}

const emptyProgress: TopicProgress = {
  byExercise: new Map(),
  passed: 0,
  failed: 0,
};

export const useTopicProgress = (topicSlug: string): TopicProgress => {
  const records = useLiveQuery(
    () => db.progress.where('topicSlug').equals(topicSlug).toArray(),
    [topicSlug],
    [],
  );

  return useMemo(() => {
    if (!records || records.length === 0) {
      return emptyProgress;
    }
    const byExercise = new Map<string, ProgressRecord>();
    let passed = 0;
    let failed = 0;
    for (const record of records) {
      byExercise.set(record.exerciseId, record);
      if (record.status === 'pass') {
        passed += 1;
      } else {
        failed += 1;
      }
    }
    return { byExercise, passed, failed };
  }, [records]);
};

export const useExerciseStatus = (
  topicSlug: string,
  exerciseId: string,
): ProgressStatus | undefined => {
  const record = useLiveQuery(
    () => db.progress.get(`${topicSlug}:${exerciseId}`),
    [topicSlug, exerciseId],
  );
  return record?.status;
};

export const useActivity = (): ActivityRecord[] => {
  const records = useLiveQuery(() => db.activity.orderBy('day').toArray(), [], []);
  return records ?? [];
};

const FREEZE_WINDOW_DAYS = 7;

const isActiveDay = (record: ActivityRecord): boolean =>
  record.exercisesAttempted > 0 ||
  (record.exercisesPassed ?? 0) > 0 ||
  (record.interviewStudied ?? 0) > 0 ||
  (record.cardsReviewed ?? 0) > 0 ||
  (record.conceptsRead ?? 0) > 0 ||
  (record.focusBlocks ?? 0) > 0;

const dayKeyAt = (offsetDays: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - offsetDays);
  return localDayKey(date);
};

export interface StreakState {
  current: number;
  best: number;
}

const computeBestStreak = (activeDays: Set<string>): number => {
  if (activeDays.size === 0) {
    return 0;
  }
  const sorted = [...activeDays].sort();
  const oldest = new Date(`${sorted[0]}T00:00:00`);
  const newest = new Date(`${sorted[sorted.length - 1]}T00:00:00`);
  const totalDays = Math.round((newest.getTime() - oldest.getTime()) / 86_400_000) + 1;

  let best = 0;
  let run = 0;
  let lastFreezeAt: number | null = null;
  const cursor = new Date(newest);
  for (let index = 0; index < totalDays; index += 1) {
    const key = localDayKey(cursor);
    if (activeDays.has(key)) {
      run += 1;
      if (run > best) {
        best = run;
      }
    } else {
      const freezeAvailable =
        run > 0 && (lastFreezeAt === null || index - lastFreezeAt >= FREEZE_WINDOW_DAYS);
      if (freezeAvailable) {
        lastFreezeAt = index;
      } else {
        run = 0;
        lastFreezeAt = null;
      }
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return best;
};

const computeCurrentStreak = (activeDays: Set<string>): number => {
  if (activeDays.size === 0) {
    return 0;
  }
  let started = false;
  let streak = 0;
  let lastFreezeAt: number | null = null;
  for (let offset = 0; offset < 366; offset += 1) {
    const key = dayKeyAt(offset);
    if (activeDays.has(key)) {
      streak += 1;
      started = true;
      continue;
    }
    if (!started && offset === 0) {
      continue;
    }
    const freezeAvailable =
      started && (lastFreezeAt === null || offset - lastFreezeAt >= FREEZE_WINDOW_DAYS);
    if (freezeAvailable) {
      lastFreezeAt = offset;
      continue;
    }
    break;
  }
  return streak;
};

export const useStreakState = (): StreakState => {
  const activity = useActivity();
  return useMemo(() => {
    const activeDays = new Set(activity.filter(isActiveDay).map((record) => record.day));
    return {
      current: computeCurrentStreak(activeDays),
      best: computeBestStreak(activeDays),
    };
  }, [activity]);
};

export const useStreak = (): number => useStreakState().current;
