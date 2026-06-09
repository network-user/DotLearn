import { useMemo } from 'react';

import type { ActivityRecord } from '@/lib/progress-db';

interface ActivityHeatmapProps {
  activity: ActivityRecord[];
  weeks?: number;
}

const isoDay = (date: Date): string => date.toISOString().slice(0, 10);

const intensityClass = (count: number, max: number): string => {
  if (count === 0) {
    return 'bg-zinc-800/60';
  }
  const ratio = max === 0 ? 0 : count / max;
  if (ratio < 0.25) return 'bg-emerald-900/70';
  if (ratio < 0.5) return 'bg-emerald-700/80';
  if (ratio < 0.75) return 'bg-emerald-500/90';
  return 'bg-emerald-300';
};

export const ActivityHeatmap = ({ activity, weeks = 14 }: ActivityHeatmapProps) => {
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
    let max = 0;
    for (const record of activity) {
      if (record.exercisesAttempted > max) {
        max = record.exercisesAttempted;
      }
    }
    const cells: Array<{ day: string; count: number; passed: number; inFuture: boolean }> = [];
    const cursor = new Date(start);
    for (let index = 0; index < weeks * 7; index += 1) {
      const day = isoDay(cursor);
      const record = byDay.get(day);
      cells.push({
        day,
        count: record?.exercisesAttempted ?? 0,
        passed: record?.exercisesPassed ?? 0,
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
              return (
                <span
                  key={dayOfWeek}
                  className={`size-3 rounded-sm ${intensityClass(cell.count, grid.max)}`}
                  title={`${cell.day} — ${cell.count} attempted, ${cell.passed} passed`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 text-[10px] text-zinc-500">
        <span>less</span>
        <span className="size-3 rounded-sm bg-zinc-800/60" />
        <span className="size-3 rounded-sm bg-emerald-900/70" />
        <span className="size-3 rounded-sm bg-emerald-700/80" />
        <span className="size-3 rounded-sm bg-emerald-500/90" />
        <span className="size-3 rounded-sm bg-emerald-300" />
        <span>more</span>
      </div>
    </div>
  );
};
