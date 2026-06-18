import { useMemo } from 'react';

import { useTranslation } from 'react-i18next';

import type { ActivityRecord } from '@/lib/progress-db';

interface ActivityHeatmapProps {
  activity: ActivityRecord[];
  weeks?: number;
}

const isoDay = (date: Date): string => date.toISOString().slice(0, 10);

const intensityClass = (count: number, max: number): string => {
  if (count === 0) {
    return 'bg-surface-2';
  }
  const ratio = max === 0 ? 0 : count / max;
  if (ratio < 0.2) return 'bg-accent/15';
  if (ratio < 0.4) return 'bg-accent/35';
  if (ratio < 0.6) return 'bg-accent/60';
  if (ratio < 0.8) return 'bg-accent/85';
  return 'bg-accent';
};

export const ActivityHeatmap = ({ activity, weeks = 14 }: ActivityHeatmapProps) => {
  const { t } = useTranslation('heatmap');
  const grid = useMemo(() => {
    const totalDays = weeks * 7;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - (totalDays - 1));
    const startDow = start.getUTCDay();
    if (startDow !== 0) {
      start.setUTCDate(start.getUTCDate() - startDow);
    }
    const byDay = new Map(activity.map((record) => [record.day, record]));
    const totalOf = (record: ActivityRecord): number =>
      record.exercisesAttempted +
      (record.cardsReviewed ?? 0) +
      (record.conceptsRead ?? 0) +
      (record.interviewStudied ?? 0);
    let max = 0;
    for (const record of activity) {
      const total = totalOf(record);
      if (total > max) {
        max = total;
      }
    }
    const cells: Array<{
      day: string;
      count: number;
      passed: number;
      reviewed: number;
      read: number;
      studied: number;
      inFuture: boolean;
    }> = [];
    const cursor = new Date(start);
    for (let index = 0; index < weeks * 7; index += 1) {
      const day = isoDay(cursor);
      const record = byDay.get(day);
      cells.push({
        day,
        count: record ? totalOf(record) : 0,
        passed: record?.exercisesPassed ?? 0,
        reviewed: record?.cardsReviewed ?? 0,
        read: record?.conceptsRead ?? 0,
        studied: record?.interviewStudied ?? 0,
        inFuture: cursor > today,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return { cells, max, weeks };
  }, [activity, weeks]);

  return (
    <div className="space-y-2">
      <div
        className="grid gap-[2px]"
        style={{ gridTemplateColumns: `repeat(${grid.weeks}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: grid.weeks }).map((_, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-[2px]">
            {Array.from({ length: 7 }).map((_, dayOfWeek) => {
              const cell = grid.cells[weekIndex * 7 + dayOfWeek];
              if (!cell || cell.inFuture) {
                return <span key={dayOfWeek} className="size-3 rounded-sm bg-transparent" />;
              }
              const cellLabel = t('tooltip', {
                day: cell.day,
                attempted: cell.count,
                passed: cell.passed,
                reviewed: cell.reviewed,
                read: cell.read,
                studied: cell.studied,
              });
              return (
                <span
                  key={dayOfWeek}
                  role="img"
                  aria-label={cellLabel}
                  className={`size-3 rounded-sm ${intensityClass(cell.count, grid.max)}`}
                  title={cellLabel}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 text-[10px] text-fg-subtle">
        <span>{t('less')}</span>
        <span aria-hidden className="size-3 rounded-sm bg-surface-2" />
        <span aria-hidden className="size-3 rounded-sm bg-accent/15" />
        <span aria-hidden className="size-3 rounded-sm bg-accent/35" />
        <span aria-hidden className="size-3 rounded-sm bg-accent/60" />
        <span aria-hidden className="size-3 rounded-sm bg-accent/85" />
        <span aria-hidden className="size-3 rounded-sm bg-accent" />
        <span>{t('more')}</span>
      </div>
      <p className="text-[10px] text-fg-subtle">
        {t('legendScale', { max: grid.max })}
      </p>
    </div>
  );
};
