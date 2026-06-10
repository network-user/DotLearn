import { useMemo } from 'react';

import { useLiveQuery } from 'dexie-react-hooks';

import { db } from './progress-db';

export const useInterviewStudiedIds = (): Set<number> => {
  const rows = useLiveQuery(() => db.interviewStudied.toArray(), [], []);
  return useMemo(() => new Set((rows ?? []).map((row) => row.id)), [rows]);
};

export const useInterviewStudied = (id: number): boolean => {
  const record = useLiveQuery(() => db.interviewStudied.get(id), [id]);
  return Boolean(record);
};
