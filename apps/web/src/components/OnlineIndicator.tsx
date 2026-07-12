import { useEffect, useId, useRef, useState } from 'react';

import { useReducedMotion } from 'framer-motion';
import { Link } from '@tanstack/react-router';
import { ArrowUpRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { cx } from '@/components/ui/cx';
import {
  fetchPresenceStats,
  type PresenceDailyPoint,
  type PresenceSeriesPoint,
  type PresenceStats,
} from '@/lib/api-client';
import { usePresence } from '@/lib/presence';
import { topicTitleOf } from '@/lib/topics';

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

const POLL_INTERVAL_MS = 30_000;

type LoadStatus = 'loading' | 'ready' | 'error';
type Range = '24h' | '7d' | '30d';

interface SparklineProps {
  series: PresenceSeriesPoint[];
  ariaLabel: string;
}

const Sparkline = ({ series, ariaLabel }: SparklineProps) => {
  const gradientId = useId();
  const width = 260;
  const height = 56;
  const pad = 4;

  const points = (series ?? [])
    .map((point) => (Number.isFinite(point?.online) ? Math.max(0, point.online) : 0))
    .filter((value) => Number.isFinite(value));

  if (points.length < 2) {
    return (
      <div
        className="grid h-14 place-items-center rounded-lg border border-dashed border-border-base/70 text-[11px] text-fg-subtle"
        role="img"
        aria-label={ariaLabel}
      >
        —
      </div>
    );
  }

  const max = Math.max(1, ...points); // Y axis from zero, never divide by zero
  const count = points.length;
  const xAt = (index: number): number => pad + (index / (count - 1)) * (width - pad * 2);
  const yAt = (value: number): number => height - pad - (value / max) * (height - pad * 2);

  const line = points.map((value, index) => `${xAt(index).toFixed(1)},${yAt(value).toFixed(1)}`);
  const area = [
    `${pad.toFixed(1)},${(height - pad).toFixed(1)}`,
    ...line,
    `${(width - pad).toFixed(1)},${(height - pad).toFixed(1)}`,
  ].join(' ');

  const last = points[points.length - 1] ?? 0;
  const lastX = xAt(count - 1);
  const lastY = yAt(last);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-14 w-full overflow-visible"
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(var(--accent-1))" stopOpacity="0.28" />
          <stop offset="100%" stopColor="rgb(var(--accent-1))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gradientId})`} />
      <polyline
        points={line.join(' ')}
        fill="none"
        stroke="rgb(var(--accent-1))"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r={2.6} fill="rgb(var(--accent-1))" />
    </svg>
  );
};

interface DailyBarsProps {
  daily: PresenceDailyPoint[];
  count: number;
  label: string;
}

const DailyBars = ({ daily, count, label }: DailyBarsProps) => {
  const window = (daily ?? []).slice(-count);
  if (window.length === 0) {
    return <div className="text-[11px] text-fg-subtle">—</div>;
  }
  const max = Math.max(1, ...window.map((day) => (Number.isFinite(day.uniques) ? day.uniques : 0)));
  return (
    <div className="flex h-12 items-end gap-1" role="img" aria-label={label}>
      {window.map((day) => {
        const value = Number.isFinite(day.uniques) ? Math.max(0, day.uniques) : 0;
        const heightPct = Math.max(6, Math.round((value / max) * 100));
        return (
          <div key={day.day} className="flex h-full flex-1 items-end">
            <div
              className="w-full rounded-sm bg-accent/70 transition-[height]"
              style={{ height: `${heightPct}%` }}
              title={`${day.day}: ${value}`}
            />
          </div>
        );
      })}
    </div>
  );
};

interface MiniStatProps {
  label: string;
  value: number;
}

const MiniStat = ({ label, value }: MiniStatProps) => (
  <div className="rounded-lg bg-surface-2/60 px-2 py-1.5">
    <div className="text-[13px] font-semibold tabular-nums text-fg">
      <AnimatedNumber value={value} />
    </div>
    <div className="text-[10px] leading-tight text-fg-subtle">{label}</div>
  </div>
);

export const OnlineIndicator = () => {
  const { t } = useTranslation('presence');
  const presence = usePresence();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [stats, setStats] = useState<PresenceStats | null>(null);
  const [range, setRange] = useState<Range>('24h');

  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Fetch full stats when the popover opens, then poll gently while it stays open.
  // The pill's own counts keep ticking from the heartbeat, so this only refreshes
  // the charts and analytics — no requests once the popover is closed.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStatus((prev) => (stats ? prev : 'loading'));
    const load = (): void => {
      fetchPresenceStats()
        .then((data) => {
          if (cancelled) return;
          setStats(data);
          setStatus('ready');
        })
        .catch(() => {
          if (cancelled) return;
          setStatus((prev) => (prev === 'ready' ? 'ready' : 'error'));
        });
    };
    load();
    const timer = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Click-outside, Escape, and focus management for the popover.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent): void => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    const trigger = triggerRef.current;
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
      trigger?.focus();
    };
  }, [open]);

  // The whole widget is optional — no presence data means the site is running
  // without the API, so render nothing.
  if (presence === null) return null;

  // The popover fetches fresh stats on open; prefer them over the last
  // heartbeat snapshot, which can lag by up to one beat interval.
  const liveOnline = status === 'ready' && stats ? stats.online : presence.online;
  const liveUniques = status === 'ready' && stats ? stats.uniquesToday : presence.uniquesToday;

  const sparkAria = t('sparklineAria', { n: liveOnline });
  // Extended metrics arrive only when the server has analytics enabled.
  const extended = stats?.uniquesAllTime !== undefined;
  const reading = stats?.reading ?? [];

  const rangeOptions: { key: Range; label: string }[] = [
    { key: '24h', label: t('range24h') },
    { key: '7d', label: t('range7d') },
    { key: '30d', label: t('range30d') },
  ];

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t('trigger', { n: presence.online })}
        title={t('trigger', { n: presence.online })}
        className={cx(
          'inline-flex h-9 items-center gap-1 rounded-full border px-1.5 text-[13px] font-medium tabular-nums transition-colors sm:gap-1.5 sm:px-2.5',
          open
            ? 'border-accent/50 bg-accent/[0.08] text-fg'
            : 'border-border-base/70 text-fg-muted hover:bg-fg/[0.04] hover:text-fg',
        )}
      >
        <span
          className={cx('size-2 rounded-full bg-ok', reduceMotion ? '' : 'dl-online-pulse')}
          aria-hidden
        />
        <span className="text-fg">
          <AnimatedNumber value={presence.online} />
        </span>
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-label={t('title')}
          className="absolute right-0 top-full z-[var(--z-sheet)] mt-2 w-80 space-y-3 rounded-xl border border-border-base glass-strong bg-surface/95 p-3.5 shadow-float"
        >
          <div className="flex items-center justify-between">
            <div className="eyebrow text-fg-subtle">{t('title')}</div>
            {extended && (
              <Link
                to="/analytics"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-0.5 text-[11px] font-medium text-accent hover:underline"
              >
                {t('moreAnalytics')}
                <ArrowUpRight size={12} aria-hidden />
              </Link>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-2xl font-semibold tabular-nums text-fg">
                <AnimatedNumber value={liveOnline} />
              </div>
              <div className="mt-0.5 text-[11px] text-fg-muted">{t('onlineNow')}</div>
            </div>
            <div>
              <div className="text-2xl font-semibold tabular-nums text-fg">
                <AnimatedNumber value={liveUniques} />
              </div>
              <div className="mt-0.5 text-[11px] text-fg-muted">{t('uniquesToday')}</div>
            </div>
          </div>

          {status === 'loading' && (
            <div className="space-y-3" aria-hidden>
              <div className="h-3 w-20 animate-pulse rounded bg-surface-2" />
              <div className="h-14 w-full animate-pulse rounded-lg bg-surface-2" />
              <div className="h-12 w-full animate-pulse rounded-lg bg-surface-2" />
            </div>
          )}

          {status === 'error' && <div className="text-[12px] text-fg-muted">{t('error')}</div>}

          {status === 'ready' && stats && (
            <>
              {extended && (
                <div className="grid grid-cols-2 gap-1.5">
                  <MiniStat label={t('allTime')} value={stats.uniquesAllTime ?? 0} />
                  <MiniStat label={t('last7days')} value={stats.uniques7d ?? 0} />
                  <MiniStat label={t('peakAllTime')} value={stats.peakAllTime ?? 0} />
                  <MiniStat label={t('totalVisits')} value={stats.totalVisitorDays ?? 0} />
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="eyebrow text-fg-subtle">
                    {range === '24h' ? t('chartOnline') : t('chartVisitors')}
                  </div>
                  <div className="flex gap-0.5 rounded-md bg-surface-2/60 p-0.5">
                    {rangeOptions.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setRange(option.key)}
                        aria-pressed={range === option.key}
                        className={cx(
                          'rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums transition-colors',
                          range === option.key
                            ? 'bg-surface text-fg shadow-sm'
                            : 'text-fg-subtle hover:text-fg',
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                {range === '24h' ? (
                  <>
                    <Sparkline series={stats.series} ariaLabel={sparkAria} />
                    <div className="text-right text-[11px] tabular-nums text-fg-muted">
                      {t('peakToday', { n: stats.peakToday })}
                    </div>
                  </>
                ) : (
                  <DailyBars
                    daily={stats.daily}
                    count={range === '7d' ? 7 : 30}
                    label={t('barsAria')}
                  />
                )}
              </div>

              {extended && reading.length > 0 && (
                <div className="space-y-1">
                  <div className="eyebrow text-fg-subtle">{t('readingNow')}</div>
                  <ul className="space-y-0.5">
                    {reading.slice(0, 3).map((item) => (
                      <li
                        key={item.topic}
                        className="flex items-center justify-between text-[12px] text-fg-muted"
                      >
                        <span className="truncate">{topicTitleOf(item.topic) ?? item.topic}</span>
                        <span className="ml-2 tabular-nums text-fg">{item.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="border-t border-border-base/60 pt-2 text-[10px] leading-snug text-fg-subtle">
                {t('privacy')}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
