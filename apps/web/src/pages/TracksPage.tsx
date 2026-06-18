import { Link } from '@tanstack/react-router';
import { ArrowRight, Route as RouteIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ProgressRing } from '@/components/ui/ProgressRing';
import { Surface } from '@/components/ui/Surface';
import { tracks, type Track } from '@/lib/tracks';
import { useTrackAggregates, type TrackAggregate } from '@/lib/use-tracks';

export const TracksPage = () => {
  const { t } = useTranslation('tracks');
  const aggregates = useTrackAggregates();

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 eyebrow text-fg-subtle">
          <RouteIcon size={12} className="text-accent" />
          <span>{t('eyebrow')}</span>
        </div>
        <h1 className="font-display text-3xl tracking-tightish text-fg">{t('title')}</h1>
        <p className="max-w-prose text-sm text-fg-muted">{t('subtitle')}</p>
      </header>

      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {tracks.map((track) => (
          <li key={track.id}>
            <TrackCard track={track} aggregate={aggregates.get(track.id)} />
          </li>
        ))}
      </ul>
    </div>
  );
};

const TrackCard = ({
  track,
  aggregate,
}: {
  track: Track;
  aggregate: TrackAggregate | undefined;
}) => {
  const { t } = useTranslation('tracks');
  const presentCount = aggregate?.presentSlugs.length ?? 0;
  const masteredCount = aggregate?.masteredCount ?? 0;
  const percent = Math.round((aggregate?.masteryAverage ?? 0) * 100);
  return (
    <Link to="/tracks/$id" params={{ id: track.id }} className="group block h-full">
      <Surface interactive className="h-full">
        <div className="flex h-full flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {track.targetRole && (
                <div className="eyebrow text-[10px] text-accent">{track.targetRole}</div>
              )}
              <h2 className="mt-1 font-display text-xl leading-tight tracking-tightish text-fg">
                {track.title}
              </h2>
            </div>
            <ProgressRing
              value={aggregate?.masteryAverage ?? 0}
              size={48}
              stroke={4}
              indicatorClassName={percent === 100 ? 'text-ok' : 'text-accent'}
            />
          </div>
          <p className="text-[13px] leading-relaxed text-fg-muted">{track.description}</p>
          <div className="mt-auto flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-fg-subtle tabular-nums">
              {t('progress.summary', { mastered: masteredCount, total: presentCount, percent })}
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-accent">
              {t('open')}
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </Surface>
    </Link>
  );
};
