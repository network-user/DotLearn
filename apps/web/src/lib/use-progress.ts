import { useMemo } from 'react';

import { useLiveQuery } from 'dexie-react-hooks';

import {
  db,
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

export const useStreak = (): number => {
  const activity = useActivity();
  return useMemo(() => {
    if (activity.length === 0) {
      return 0;
    }
    const activeDays = new Set(activity.map((record) => record.day));
    let streak = 0;
    const cursor = new Date();
    while (true) {
      const day = cursor.toISOString().slice(0, 10);
      if (!activeDays.has(day)) {
        if (streak === 0) {
          cursor.setUTCDate(cursor.getUTCDate() - 1);
          const prev = cursor.toISOString().slice(0, 10);
          if (!activeDays.has(prev)) {
            break;
          }
          continue;
        }
        break;
      }
      streak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    return streak;
  }, [activity]);
};
