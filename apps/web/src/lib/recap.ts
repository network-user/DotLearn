import { localDayKey, type ActivityRecord } from './progress-db';

export interface WeekTotals {
  weekKey: string;
  weekStart: string;
  conceptsRead: number;
  exercisesPassed: number;
  cardsReviewed: number;
  interviewStudied: number;
  activeDays: number;
}

export interface WeeklyComparison {
  thisWeek: WeekTotals;
  lastWeek: WeekTotals | undefined;
  delta: {
    conceptsRead: number;
    exercisesPassed: number;
    cardsReviewed: number;
    interviewStudied: number;
    activeDays: number;
  };
}

export interface SparklinePoint {
  day: string;
  value: number;
  isToday: boolean;
}

const MS_PER_DAY = 86_400_000;

const parseDayKey = (day: string): Date => new Date(`${day}T00:00:00`);

const mondayOf = (date: Date): Date => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekdayFromMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - weekdayFromMonday);
  return start;
};

const isoWeekKey = (date: Date): string => {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);
  const week =
    1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * MS_PER_DAY));
  return `${target.getUTCFullYear()}-W${`${week}`.padStart(2, '0')}`;
};

const isActive = (record: ActivityRecord): boolean =>
  record.exercisesAttempted > 0 ||
  (record.exercisesPassed ?? 0) > 0 ||
  (record.interviewStudied ?? 0) > 0 ||
  (record.cardsReviewed ?? 0) > 0 ||
  (record.conceptsRead ?? 0) > 0 ||
  (record.focusBlocks ?? 0) > 0;

const emptyWeek = (weekKey: string, weekStart: string): WeekTotals => ({
  weekKey,
  weekStart,
  conceptsRead: 0,
  exercisesPassed: 0,
  cardsReviewed: 0,
  interviewStudied: 0,
  activeDays: 0,
});

export const bucketByWeek = (activity: readonly ActivityRecord[]): WeekTotals[] => {
  const byWeek = new Map<string, WeekTotals>();
  for (const record of activity) {
    const date = parseDayKey(record.day);
    if (Number.isNaN(date.getTime())) continue;
    const weekKey = isoWeekKey(date);
    const existing = byWeek.get(weekKey) ?? emptyWeek(weekKey, localDayKey(mondayOf(date)));
    existing.conceptsRead += record.conceptsRead ?? 0;
    existing.exercisesPassed += record.exercisesPassed ?? 0;
    existing.cardsReviewed += record.cardsReviewed ?? 0;
    existing.interviewStudied += record.interviewStudied ?? 0;
    if (isActive(record)) existing.activeDays += 1;
    byWeek.set(weekKey, existing);
  }
  return [...byWeek.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
};

export const compareWeeks = (
  activity: readonly ActivityRecord[],
  now: Date = new Date(),
): WeeklyComparison => {
  const weeks = bucketByWeek(activity);
  const thisWeekStart = localDayKey(mondayOf(now));
  const lastWeekStart = localDayKey(mondayOf(new Date(mondayOf(now).getTime() - 7 * MS_PER_DAY)));

  const thisWeek = weeks.find((week) => week.weekStart === thisWeekStart) ?? {
    ...emptyWeek(isoWeekKey(now), thisWeekStart),
  };
  const lastWeek = weeks.find((week) => week.weekStart === lastWeekStart);

  return {
    thisWeek,
    lastWeek,
    delta: {
      conceptsRead: thisWeek.conceptsRead - (lastWeek?.conceptsRead ?? 0),
      exercisesPassed: thisWeek.exercisesPassed - (lastWeek?.exercisesPassed ?? 0),
      cardsReviewed: thisWeek.cardsReviewed - (lastWeek?.cardsReviewed ?? 0),
      interviewStudied: thisWeek.interviewStudied - (lastWeek?.interviewStudied ?? 0),
      activeDays: thisWeek.activeDays - (lastWeek?.activeDays ?? 0),
    },
  };
};

const weightedDayValue = (record: ActivityRecord | undefined): number => {
  if (!record) return 0;
  return (
    (record.exercisesPassed ?? 0) +
    (record.cardsReviewed ?? 0) * 0.25 +
    (record.conceptsRead ?? 0) * 0.5 +
    (record.interviewStudied ?? 0) * 0.5
  );
};

export const lastSevenDays = (
  activity: readonly ActivityRecord[],
  now: Date = new Date(),
): SparklinePoint[] => {
  const byDay = new Map<string, ActivityRecord>();
  for (const record of activity) byDay.set(record.day, record);
  const todayKey = localDayKey(now);
  const points: SparklinePoint[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    const day = localDayKey(date);
    points.push({
      day,
      value: Math.round(weightedDayValue(byDay.get(day)) * 10) / 10,
      isToday: day === todayKey,
    });
  }
  return points;
};
