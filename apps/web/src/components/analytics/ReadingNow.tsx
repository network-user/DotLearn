import { useTranslation } from 'react-i18next';

import type { PresenceReadingPoint } from '@/lib/api-client';
import { topicTitleOf } from '@/lib/topics';

import { Section } from './common';

interface ReadingNowProps {
  reading: PresenceReadingPoint[];
}

export const ReadingNow = ({ reading }: ReadingNowProps) => {
  const { t } = useTranslation('analytics');
  const items = reading ?? [];

  if (items.length === 0) {
    return (
      <Section title={t('readingNow')}>
        <p className="text-sm text-fg-subtle">{t('readingEmpty')}</p>
      </Section>
    );
  }

  const max = Math.max(1, ...items.map((item) => Math.max(0, item.count)));

  return (
    <Section title={t('readingNow')}>
      <ul className="space-y-2.5">
        {items.map((item) => {
          const value = Math.max(0, item.count);
          const widthPct = Math.max(4, Math.round((value / max) * 100));
          return (
            <li key={item.topic} className="flex items-center gap-3">
              <span className="w-40 shrink-0 truncate text-sm text-fg sm:w-56">
                {topicTitleOf(item.topic) ?? item.topic}
              </span>
              <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                <span
                  className="absolute inset-y-0 left-0 rounded-full bg-accent"
                  style={{ width: `${widthPct}%` }}
                />
              </span>
              <span className="w-8 shrink-0 text-right text-sm tabular-nums text-fg">{value}</span>
            </li>
          );
        })}
      </ul>
    </Section>
  );
};
