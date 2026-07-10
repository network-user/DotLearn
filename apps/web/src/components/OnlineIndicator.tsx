import { useEffect, useId, useRef, useState } from 'react';

import { useReducedMotion } from 'framer-motion';
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

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

type LoadStatus = 'loading' | 'ready' | 'error';

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
  label: string;
}

const DailyBars = ({ daily, label }: DailyBarsProps) => {
  const last7 = (daily ?? []).slice(-7);
  if (last7.length === 0) {
    return <div className="text-[11px] text-fg-subtle">—</div>;
  }
  const max = Math.max(1, ...last7.map((day) => (Number.isFinite(day.uniques) ? day.uniques : 0)));
  return (
    <div className="flex h-12 items-end gap-1.5" role="img" aria-label={label}>
      {last7.map((day) => {
        const value = Number.isFinite(day.uniques) ? Math.max(0, day.uniques) : 0;
        const heightPct = Math.max(6, Math.round((value / max) * 100));
        return (
          <div key={day.day} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-full w-full items-end">
              <div
                className="w-full rounded-sm bg-accent/70"
                style={{ height: `${heightPct}%` }}
                title={`${day.day}: ${value}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const OnlineIndicator = () => {
  const { t } = useTranslation('presence');
  const presence = usePresence();
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [stats, setStats] = useState<PresenceStats | null>(null);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Fetch full stats each time the popover opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStatus('loading');
    fetchPresenceStats()
      .then((data) => {
        if (cancelled) return;
        setStats(data);
        setStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
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
          'inline-flex h-9 items-center gap-1.5 rounded-full border px-2.5 text-[13px] font-medium tabular-nums transition-colors',
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
          className="absolute right-0 top-full z-[var(--z-sheet)] mt-2 w-72 space-y-3 rounded-xl border border-border-base glass-strong bg-surface/95 p-3.5 shadow-float"
        >
          <div className="eyebrow text-fg-subtle">{t('title')}</div>

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
              <div className="space-y-1.5">
                <div className="eyebrow text-fg-subtle">{t('last24h')}</div>
                <Sparkline series={stats.series} ariaLabel={sparkAria} />
              </div>
              <div className="space-y-1.5">
                <div className="eyebrow text-fg-subtle">{t('last7days')}</div>
                <DailyBars daily={stats.daily} label={t('last7days')} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
