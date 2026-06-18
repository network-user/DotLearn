import { useMemo } from 'react';

import { useLiveQuery } from 'dexie-react-hooks';

import { db, type ExamResultRecord } from './progress-db';

export const useInterviewStudiedIds = (): Set<number> => {
  const rows = useLiveQuery(() => db.interviewStudied.toArray(), [], []);
  return useMemo(() => new Set((rows ?? []).map((row) => row.id)), [rows]);
};

export const useInterviewStudied = (id: number): boolean => {
  const record = useLiveQuery(() => db.interviewStudied.get(id), [id]);
  return Boolean(record);
};

export const useExamResults = (scope: string, limit = 12): ExamResultRecord[] => {
  const rows = useLiveQuery(
    () => db.examResults.where('scope').equals(scope).toArray(),
    [scope],
    [],
  );
  return useMemo(
    () =>
      [...(rows ?? [])]
        .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))
        .slice(0, limit),
    [rows, limit],
  );
};
