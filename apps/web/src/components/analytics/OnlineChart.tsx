import { useId, useMemo, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';

import { useTranslation } from 'react-i18next';

import type { PresenceSeriesPoint } from '@/lib/api-client';

import { clamp, formatHm, NoData, Section } from './common';

interface OnlineChartProps {
  series: PresenceSeriesPoint[];
}

const W = 760;
const H = 240;
const PAD_L = 6;
const PAD_R = 6;
const PAD_T = 16;
const PAD_B = 26;

interface Node {
  t: number;
  v: number;
  x: number;
  y: number;
}

export const OnlineChart = ({ series }: OnlineChartProps) => {
  const { t } = useTranslation('analytics');
  const gradientId = useId();
  const [active, setActive] = useState<number | null>(null);

  const model = useMemo(() => {
    const points = (series ?? []).filter(
      (point) => Number.isFinite(point?.t) && Number.isFinite(point?.online),
    );
    if (points.length < 2) return null;

    const times = points.map((point) => point.t);
    const values = points.map((point) => Math.max(0, point.online));
    const tMin = Math.min(...times);
    const tMax = Math.max(...times);
    const span = Math.max(1, tMax - tMin);
    const maxV = Math.max(1, ...values);
    const sum = values.reduce((total, value) => total + value, 0);
    const avg = sum / values.length;
    const peak = Math.max(...values);

    const plotW = W - PAD_L - PAD_R;
    const plotH = H - PAD_T - PAD_B;
    const baseY = H - PAD_B;
    const xAt = (time: number): number => PAD_L + ((time - tMin) / span) * plotW;
    const yAt = (value: number): number => baseY - (value / maxV) * plotH;

    const nodes: Node[] = points.map((point) => {
      const v = Math.max(0, point.online);
      return { t: point.t, v, x: xAt(point.t), y: yAt(v) };
    });

    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (!first || !last) return null;

    const linePath = nodes
      .map((node, index) => `${index === 0 ? 'M' : 'L'}${node.x.toFixed(1)},${node.y.toFixed(1)}`)
      .join(' ');
    const areaPath =
      `M${first.x.toFixed(1)},${baseY.toFixed(1)} ` +
      nodes.map((node) => `L${node.x.toFixed(1)},${node.y.toFixed(1)}`).join(' ') +
      ` L${last.x.toFixed(1)},${baseY.toFixed(1)} Z`;

    return {
      nodes,
      linePath,
      areaPath,
      baseY,
      avg,
      peak,
      now: last.v,
      avgY: yAt(avg),
      peakY: yAt(peak),
    };
  }, [series]);

  if (!model) {
    return (
      <Section title={t('online24h')}>
        <NoData label={t('noData')} />
      </Section>
    );
  }

  const { nodes } = model;
  const activeNode = active === null ? undefined : nodes[active];

  const handleMove = (event: ReactPointerEvent<SVGSVGElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const frac = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const targetX = PAD_L + frac * (W - PAD_L - PAD_R);
    let bestIndex = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    nodes.forEach((node, index) => {
      const dist = Math.abs(node.x - targetX);
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = index;
      }
    });
    setActive(bestIndex);
  };

  const summary = `${t('srOnlineTable')}. ${t('avg')}: ${Math.round(model.avg)}, ${t('peak')}: ${model.peak}, ${t('now')}: ${model.now}.`;
  const leftPct = activeNode ? (activeNode.x / W) * 100 : 0;

  return (
    <Section title={t('online24h')}>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full touch-none select-none overflow-visible"
          role="img"
          aria-label={summary}
          onPointerMove={handleMove}
          onPointerLeave={() => setActive(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--accent-1))" stopOpacity="0.26" />
              <stop offset="100%" stopColor="rgb(var(--accent-1))" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Average and peak reference lines */}
          <line
            x1={PAD_L}
            x2={W - PAD_R}
            y1={model.peakY}
            y2={model.peakY}
            stroke="rgb(var(--accent-1))"
            strokeOpacity="0.35"
            strokeWidth={1}
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={PAD_L}
            x2={W - PAD_R}
            y1={model.avgY}
            y2={model.avgY}
            stroke="currentColor"
            className="text-fg-subtle"
            strokeOpacity="0.4"
            strokeWidth={1}
            strokeDasharray="2 4"
            vectorEffect="non-scaling-stroke"
          />

          <path d={model.areaPath} fill={`url(#${gradientId})`} />
          <path
            d={model.linePath}
            fill="none"
            stroke="rgb(var(--accent-1))"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {activeNode && (
            <>
              <line
                x1={activeNode.x}
                x2={activeNode.x}
                y1={PAD_T}
                y2={model.baseY}
                stroke="currentColor"
                className="text-fg-subtle"
                strokeOpacity="0.5"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={activeNode.x}
                cy={activeNode.y}
                r={3}
                fill="rgb(var(--accent-1))"
                stroke="rgb(var(--surface))"
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
        </svg>

        {activeNode && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-md border border-border-base bg-surface px-2 py-1 text-[11px] tabular-nums text-fg shadow-float"
            style={{ left: `${clamp(leftPct, 6, 94)}%` }}
          >
            <span className="text-fg-subtle">{formatHm(activeNode.t)}</span>
            <span className="ml-1.5 font-semibold text-fg">{activeNode.v}</span>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] tabular-nums text-fg-subtle">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-0 w-4 border-t border-dashed border-current"
          />
          {t('avg')}: <span className="text-fg">{Math.round(model.avg)}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-block h-0 w-4 border-t border-dashed"
            style={{ borderColor: 'rgb(var(--accent-1))' }}
          />
          {t('peak')}: <span className="text-fg">{model.peak}</span>
        </span>
        <span>
          {t('now')}: <span className="text-fg">{model.now}</span>
        </span>
      </div>
      <p className="sr-only">{summary}</p>
    </Section>
  );
};
