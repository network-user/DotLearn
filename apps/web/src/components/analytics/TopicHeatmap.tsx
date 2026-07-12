import { useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';

import { cx } from '@/components/ui/cx';
import type { PresenceTopicStat } from '@/lib/api-client';
import { topicTitleOf } from '@/lib/topics';

import { NoData, Section } from './common';

interface TopicHeatmapProps {
  topics: PresenceTopicStat[];
  days: string[];
}

const CAP = 15;

interface Row {
  topic: string;
  title: string;
  cells: { day: string; value: number }[];
}

export const TopicHeatmap = ({ topics, days }: TopicHeatmapProps) => {
  const { t } = useTranslation('analytics');
  const [showAll, setShowAll] = useState(false);

  const ranked = useMemo(() => {
    const copy = [...(topics ?? [])];
    copy.sort((a, b) => b.uniquesAllTime - a.uniquesAllTime);
    return copy;
  }, [topics]);

  const visible = showAll ? ranked : ranked.slice(0, CAP);

  const { rows, max } = useMemo(() => {
    let maxCell = 1;
    const built: Row[] = visible.map((topic) => {
      const byDay = new Map<string, number>();
      for (const point of topic.daily) {
        byDay.set(point.day, Math.max(0, point.uniques));
      }
      const cells = days.map((day) => {
        const value = byDay.get(day) ?? 0;
        if (value > maxCell) maxCell = value;
        return { day, value };
      });
      return { topic: topic.topic, title: topicTitleOf(topic.topic) ?? topic.topic, cells };
    });
    return { rows: built, max: maxCell };
  }, [visible, days]);

  if (ranked.length === 0 || days.length === 0) {
    return (
      <Section title={t('topicActivity')}>
        <NoData label={t('noData')} />
      </Section>
    );
  }

  const columns = `minmax(7.5rem, 10rem) repeat(${days.length}, minmax(0, 1fr))`;

  return (
    <Section title={t('topicActivity')}>
      <div className="overflow-x-auto">
        <div className="min-w-[640px] space-y-1">
          {rows.map((row) => (
            <div
              key={row.topic}
              className="grid items-center gap-1"
              style={{ gridTemplateColumns: columns }}
            >
              <span className="truncate pr-2 text-xs text-fg" title={row.title}>
                {row.title}
              </span>
              {row.cells.map((cell) => {
                const alpha = cell.value === 0 ? 0 : 0.15 + 0.85 * (cell.value / max);
                return (
                  <span
                    key={cell.day}
                    className={cx(
                      'aspect-square rounded-[3px]',
                      cell.value === 0 && 'bg-surface-2',
                    )}
                    style={
                      cell.value === 0
                        ? undefined
                        : { backgroundColor: `rgb(var(--accent-1) / ${alpha.toFixed(3)})` }
                    }
                    title={`${row.title} · ${t('tooltipDay', { day: cell.day, value: cell.value })}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {ranked.length > CAP && (
        <button
          type="button"
          onClick={() => setShowAll((value) => !value)}
          className="mt-4 text-xs font-medium text-accent hover:underline"
        >
          {showAll ? t('showLess') : t('showAll')}
        </button>
      )}
    </Section>
  );
};
