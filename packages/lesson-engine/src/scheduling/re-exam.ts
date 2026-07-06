export const RE_EXAM_LADDER_DAYS = [1, 3, 7, 16, 35] as const;

export interface ReExamState {
  stepIndex: number;
  streak: number;
  graduated: boolean;
}

export interface ReExamSchedule extends ReExamState {
  due: string;
  lastStatus: 'pass' | 'fail';
}

const MS_PER_DAY = 86_400_000;

const dueAfterDays = (now: Date, days: number): string =>
  new Date(now.getTime() + days * MS_PER_DAY).toISOString();

const ladderStep = (ladder: readonly number[], index: number): number => {
  const days = ladder[index];
  if (days === undefined) {
    throw new Error(`re-exam ladder has no step at index ${index}`);
  }
  return days;
};

export const scheduleReExam = (
  prev: ReExamState | undefined,
  passed: boolean,
  now: Date,
  ladder: readonly number[] = RE_EXAM_LADDER_DAYS,
): ReExamSchedule => {
  if (!passed) {
    return {
      stepIndex: 0,
      streak: 0,
      graduated: false,
      due: dueAfterDays(now, ladderStep(ladder, 0)),
      lastStatus: 'fail',
    };
  }

  const stepIndex = Math.min((prev?.stepIndex ?? -1) + 1, ladder.length - 1);
  const streak = (prev?.streak ?? 0) + 1;
  const graduated = stepIndex === ladder.length - 1;

  return {
    stepIndex,
    streak,
    graduated,
    due: dueAfterDays(now, ladderStep(ladder, stepIndex)),
    lastStatus: 'pass',
  };
};

export const isReExamDue = (record: { due: string } | undefined, now: Date): boolean => {
  if (!record) return false;
  return new Date(record.due).getTime() <= now.getTime();
};
