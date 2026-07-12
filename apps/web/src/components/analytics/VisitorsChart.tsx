import { useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';

import type { PresenceDailyPoint } from '@/lib/api-client';

import { NoData, Section, Segmented } from './common';

interface VisitorsChartProps {
  daily: PresenceDailyPoint[];
}

type Metric = 'uniques' | 'peak';

const W = 760;
const H = 220;
const PAD_L = 4;
const PAD_R = 4;
const PAD_T = 10;
const PAD_B = 24;

interface Bar {
  day: string;
  value: number;
  x: number;
  y: number;
  w: number;
  h: number;
  isToday: boolean;
  showLabel: boolean;
}

export const VisitorsChart = ({ daily }: VisitorsChartProps) => {
  const { t } = useTranslation('analytics');
  const [metric, setMetric] = useState<Metric>('uniques');
  const [active, setActive] = useState<number | null>(null);

  const window = useMemo(() => (daily ?? []).slice(-30), [daily]);

  const bars = useMemo<Bar[]>(() => {
    if (window.length === 0) return [];
    const values = window.map((point) =>
      Math.max(0, metric === 'uniques' ? point.uniques : point.peak),
    );
    const maxV = Math.max(1, ...values);
    const plotW = W - PAD_L - PAD_R;
    const plotH = H - PAD_T - PAD_B;
    const baseY = H - PAD_B;
    const slot = plotW / window.length;
    const barW = Math.max(2, slot * 0.72);
    const labelEvery = Math.ceil(window.length / 6);

    return window.map((point, index) => {
      const value = values[index] ?? 0;
      const h = (value / maxV) * plotH;
      const x = PAD_L + index * slot + (slot - barW) / 2;
      return {
        day: point.day,
        value,
        x,
        y: baseY - h,
        w: barW,
        h,
        isToday: index === window.length - 1,
        showLabel: index % labelEvery === 0 || index === window.length - 1,
      };
    });
  }, [window, metric]);

  if (bars.length === 0) {
    return (
      <Section
        title={t('visitorsByDay')}
        right={
          <Segmented<Metric>
            ariaLabel={t('visitorsByDay')}
            value={metric}
            onChange={setMetric}
            options={[
              { key: 'uniques', label: t('metricUniques') },
              { key: 'peak', label: t('metricPeak') },
            ]}
          />
        }
      >
        <NoData label={t('noData')} />
      </Section>
    );
  }

  const activeBar = active === null ? undefined : bars[active];
  const baseY = H - PAD_B;
  const leftPct = activeBar ? ((activeBar.x + activeBar.w / 2) / W) * 100 : 0;
  const summary = `${t('srVisitorsTable')} (${window.length}).`;

  return (
    <Section
      title={t('visitorsByDay')}
      right={
        <Segmented<Metric>
          ariaLabel={t('visitorsByDay')}
          value={metric}
          onChange={setMetric}
          options={[
            { key: 'uniques', label: t('metricUniques') },
            { key: 'peak', label: t('metricPeak') },
          ]}
        />
      }
    >
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full touch-none select-none overflow-visible"
          role="img"
          aria-label={summary}
          onPointerLeave={() => setActive(null)}
        >
          <line
            x1={PAD_L}
            x2={W - PAD_R}
            y1={baseY}
            y2={baseY}
            stroke="currentColor"
            className="text-border-base"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
          {bars.map((bar, index) => (
            <g key={bar.day}>
              <rect
                x={bar.x}
                y={bar.y}
                width={bar.w}
                height={Math.max(0, bar.h)}
                rx={Math.min(2, bar.w / 2)}
                fill="rgb(var(--accent-1))"
                fillOpacity={bar.isToday ? 1 : active === index ? 0.85 : 0.5}
                onPointerEnter={() => setActive(index)}
              >
                <title>{t('tooltipDay', { day: bar.day, value: bar.value })}</title>
              </rect>
              {bar.showLabel && (
                <text
                  x={bar.x + bar.w / 2}
                  y={H - 8}
                  textAnchor="middle"
                  className="fill-current text-fg-subtle"
                  fontSize={11}
                >
                  {bar.day.slice(5)}
                </text>
              )}
            </g>
          ))}
        </svg>

        {activeBar && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border border-border-base bg-surface px-2 py-1 text-[11px] tabular-nums text-fg shadow-float"
            style={{ left: `${Math.min(94, Math.max(6, leftPct))}%` }}
          >
            {t('tooltipDay', { day: activeBar.day, value: activeBar.value })}
          </div>
        )}
      </div>
      <p className="sr-only">{summary}</p>
    </Section>
  );
};
