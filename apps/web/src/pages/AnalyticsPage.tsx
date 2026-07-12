import { useCallback, useEffect, useRef, useState } from 'react';

import { useReducedMotion } from 'framer-motion';
import { Link } from '@tanstack/react-router';
import { Activity, ArrowLeft, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { KpiGrid } from '@/components/analytics/KpiGrid';
import { OnlineChart } from '@/components/analytics/OnlineChart';
import { PopularTopics } from '@/components/analytics/PopularTopics';
import { ReadingNow } from '@/components/analytics/ReadingNow';
import { TopicHeatmap } from '@/components/analytics/TopicHeatmap';
import { VisitorsChart } from '@/components/analytics/VisitorsChart';
import { cx } from '@/components/ui/cx';
import { fetchPresenceAnalytics, type PresenceAnalytics } from '@/lib/api-client';
import { Seo } from '@/lib/seo';

const REFRESH_MS = 30_000;

type Status = 'loading' | 'ready' | 'unavailable';

const Skeleton = () => (
  <div className="space-y-10" aria-hidden>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="h-24 animate-pulse rounded-xl bg-surface-2" />
      ))}
    </div>
    <div className="h-64 animate-pulse rounded-xl bg-surface-2" />
    <div className="h-56 animate-pulse rounded-xl bg-surface-2" />
  </div>
);

export const AnalyticsPage = () => {
  const { t } = useTranslation('analytics');
  const reduceMotion = useReducedMotion();

  const [data, setData] = useState<PresenceAnalytics | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const dataRef = useRef<PresenceAnalytics | null>(null);

  // A 404 (analytics disabled on this instance) or any transient failure both land
  // here. On a background refresh we keep the last good snapshot on screen; only a
  // failure with no data yet flips the page into the "unavailable" notice.
  const load = useCallback(async (manual = false): Promise<void> => {
    if (manual) setRefreshing(true);
    try {
      const next = await fetchPresenceAnalytics();
      dataRef.current = next;
      setData(next);
      setStatus('ready');
    } catch {
      if (dataRef.current === null) setStatus('unavailable');
    } finally {
      if (manual) setRefreshing(false);
    }
  }, []);

  // Initial fetch + poll every 30s while the tab is visible (Page Visibility API):
  // pause the timer when hidden, refetch immediately and resume when shown again.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const run = (): void => {
      if (!cancelled) void load();
    };
    const startTimer = (): void => {
      if (timer === null) timer = setInterval(run, REFRESH_MS);
    };
    const stopTimer = (): void => {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    };
    const onVisibility = (): void => {
      if (document.hidden) {
        stopTimer();
      } else {
        run();
        startTimer();
      }
    };

    run();
    if (!document.hidden) startTimer();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      stopTimer();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [load]);

  const handleRetry = useCallback(() => {
    setStatus('loading');
    void load();
  }, [load]);

  const seo = <Seo title={t('title')} description={t('subtitle')} robots="noindex,nofollow" />;

  if (status === 'unavailable') {
    return (
      <div className="mx-auto max-w-md">
        {seo}
        <div className="glass-strong flex flex-col items-center gap-4 rounded-xl border border-border-base p-8 text-center shadow-float">
          <span className="grid size-12 place-items-center rounded-full bg-surface-2 text-fg-subtle">
            <Activity size={22} aria-hidden />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-fg">{t('disabledTitle')}</h1>
            <p className="mt-2 text-sm text-fg-muted">{t('disabledText')}</p>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-2 text-sm text-fg transition-colors hover:bg-surface-2"
          >
            <RefreshCw size={15} aria-hidden />
            {t('retry')}
          </button>
          <Link to="/" className="text-xs font-medium text-accent hover:underline">
            {t('backHome')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {seo}

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-xs font-medium text-fg-subtle transition-colors hover:text-fg"
          >
            <ArrowLeft size={13} aria-hidden />
            {t('backHome')}
          </Link>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-fg">{t('title')}</h1>
          <p className="mt-2 max-w-2xl text-sm text-fg-muted">{t('subtitle')}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-fg-subtle">
            <span
              aria-hidden
              className={cx('size-1.5 rounded-full bg-ok', reduceMotion ? '' : 'dl-online-pulse')}
            />
            {t('autoUpdate')}
          </span>
          <button
            type="button"
            onClick={() => void load(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-1.5 text-sm text-fg transition-colors hover:bg-surface-2"
          >
            <RefreshCw
              size={15}
              aria-hidden
              className={cx(refreshing && !reduceMotion && 'animate-spin')}
            />
            {t('refresh')}
          </button>
        </div>
      </header>

      {status === 'loading' || data === null ? (
        <Skeleton />
      ) : (
        <>
          <KpiGrid data={data} />
          <OnlineChart series={data.series} />
          <VisitorsChart daily={data.daily} />
          <ReadingNow reading={data.reading} />
          <PopularTopics topics={data.topics} />
          <TopicHeatmap
            topics={data.topics}
            days={data.daily.map((point) => point.day).slice(-30)}
          />
          <p className="text-xs leading-relaxed text-fg-subtle">{t('privacy')}</p>
        </>
      )}
    </div>
  );
};
