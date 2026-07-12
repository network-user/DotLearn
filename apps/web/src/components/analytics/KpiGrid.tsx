import { useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { cx } from '@/components/ui/cx';
import type { PresenceAnalytics } from '@/lib/api-client';

interface KpiGridProps {
  data: PresenceAnalytics;
}

interface Tile {
  label: string;
  value: number;
  live?: boolean;
}

export const KpiGrid = ({ data }: KpiGridProps) => {
  const { t } = useTranslation('analytics');
  const reduceMotion = useReducedMotion();

  const tiles: Tile[] = [
    { label: t('kpiOnlineNow'), value: data.online, live: true },
    { label: t('kpiUniquesToday'), value: data.uniquesToday },
    { label: t('kpiPeakToday'), value: data.peakToday },
    { label: t('kpiUniques7d'), value: data.uniques7d },
    { label: t('kpiUniques30d'), value: data.uniques30d },
    { label: t('kpiUniquesAllTime'), value: data.uniquesAllTime },
    { label: t('kpiPeakAllTime'), value: data.peakAllTime },
    { label: t('kpiTotalVisits'), value: data.totalVisitorDays },
  ];

  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          className="rounded-xl border border-border-base bg-surface p-4 shadow-float"
        >
          <div className="flex items-center gap-1.5">
            {tile.live && (
              <span
                aria-hidden
                className={cx('size-2 rounded-full bg-ok', reduceMotion ? '' : 'dl-online-pulse')}
              />
            )}
            <p className="eyebrow text-fg-subtle">{tile.label}</p>
          </div>
          <p className="mt-1.5 text-2xl font-semibold tabular-nums text-fg sm:text-3xl">
            <AnimatedNumber value={tile.value} />
          </p>
        </div>
      ))}
    </section>
  );
};
