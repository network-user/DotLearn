import { useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';

import type { PresenceTopicStat } from '@/lib/api-client';
import { topicTitleOf } from '@/lib/topics';

import { NoData, Section, Segmented } from './common';

interface PopularTopicsProps {
  topics: PresenceTopicStat[];
}

type Sort = 'allTime' | '7d';

const CAP = 8;

const sum7d = (topic: PresenceTopicStat): number =>
  topic.daily.slice(-7).reduce((total, point) => total + Math.max(0, point.uniques), 0);

export const PopularTopics = ({ topics }: PopularTopicsProps) => {
  const { t } = useTranslation('analytics');
  const [sort, setSort] = useState<Sort>('allTime');
  const [showAll, setShowAll] = useState(false);

  const sorted = useMemo(() => {
    const copy = [...(topics ?? [])];
    copy.sort((a, b) =>
      sort === 'allTime' ? b.uniquesAllTime - a.uniquesAllTime : sum7d(b) - sum7d(a),
    );
    return copy;
  }, [topics, sort]);

  const controls = (
    <Segmented<Sort>
      ariaLabel={t('topTopics')}
      value={sort}
      onChange={setSort}
      options={[
        { key: 'allTime', label: t('sortAllTime') },
        { key: '7d', label: t('sort7d') },
      ]}
    />
  );

  if (sorted.length === 0) {
    return (
      <Section title={t('topTopics')} right={controls}>
        <NoData label={t('noData')} />
      </Section>
    );
  }

  const max = Math.max(1, ...sorted.map((topic) => Math.max(0, topic.uniquesAllTime)));
  const visible = showAll ? sorted : sorted.slice(0, CAP);

  return (
    <Section title={t('topTopics')} right={controls}>
      <ul className="space-y-2.5">
        {visible.map((topic) => {
          const value = Math.max(0, topic.uniquesAllTime);
          const widthPct = Math.max(3, Math.round((value / max) * 100));
          return (
            <li key={topic.topic} className="flex items-center gap-3">
              <span className="w-40 shrink-0 truncate text-sm text-fg sm:w-56">
                {topicTitleOf(topic.topic) ?? topic.topic}
              </span>
              <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-accent"
                  style={{ width: `${widthPct}%` }}
                />
              </span>
              <span className="shrink-0 whitespace-nowrap text-right text-xs tabular-nums text-fg-subtle">
                <span className="font-semibold text-fg">{value}</span> {t('readersAllTime')}
              </span>
            </li>
          );
        })}
      </ul>

      {sorted.length > CAP && (
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
