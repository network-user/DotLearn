import { useMemo, useState } from 'react';

import { useReducedMotion } from 'framer-motion';

import { cx } from '@/components/ui/cx';
import { VizButton, VizShell } from '@/components/viz/VizShell';

export type PrPoint = [recall: number, precision: number];

export interface PrCurveProps {
  label?: string;
  points?: PrPoint[];
  apLabel?: string;
  recallLabel?: string;
  precisionLabel?: string;
  interpolateLabel?: string;
  rawLabel?: string;
  hintLabel?: string;
}

const VIEW = 280;
const PAD_LEFT = 34;
const PAD_BOTTOM = 26;
const PAD_TOP = 12;
const PAD_RIGHT = 12;

const defaultPoints: PrPoint[] = [
  [0.0, 1.0],
  [0.1, 1.0],
  [0.2, 0.92],
  [0.3, 0.95],
  [0.4, 0.86],
  [0.5, 0.88],
  [0.6, 0.78],
  [0.7, 0.7],
  [0.8, 0.55],
  [0.9, 0.4],
  [1.0, 0.3],
];

const plotWidth = VIEW - PAD_LEFT - PAD_RIGHT;
const plotHeight = VIEW - PAD_TOP - PAD_BOTTOM;

const toX = (recall: number): number => PAD_LEFT + recall * plotWidth;
const toY = (precision: number): number => PAD_TOP + (1 - precision) * plotHeight;

const interpolatePrecision = (sorted: PrPoint[]): PrPoint[] =>
  sorted.map(([recall], index) => {
    let maxPrecision = 0;
    for (let later = index; later < sorted.length; later += 1) {
      maxPrecision = Math.max(maxPrecision, sorted[later]?.[1] ?? 0);
    }
    return [recall, maxPrecision];
  });

const areaUnder = (curve: PrPoint[]): number => {
  let area = 0;
  for (let index = 1; index < curve.length; index += 1) {
    const previous = curve[index - 1];
    const point = curve[index];
    if (!previous || !point) continue;
    const [r0, p0] = previous;
    const [r1, p1] = point;
    area += ((p0 + p1) / 2) * (r1 - r0);
  }
  return area;
};

export const PrCurve = ({
  label = 'Кривая Precision-Recall',
  points = defaultPoints,
  apLabel = 'AP',
  recallLabel = 'Recall',
  precisionLabel = 'Precision',
  interpolateLabel = 'Интерполировать',
  rawLabel = 'Исходная',
  hintLabel = 'Average Precision: площадь под кривой. Интерполяция берёт максимум precision справа от каждой точки.',
}: PrCurveProps) => {
  const reduceMotion = useReducedMotion();
  const [interpolated, setInterpolated] = useState(false);

  const sorted = useMemo<PrPoint[]>(
    () =>
      [...points]
        .filter(([recall, precision]) => recall >= 0 && precision >= 0)
        .sort((a, b) => a[0] - b[0]),
    [points],
  );

  const interpolatedCurve = useMemo(() => interpolatePrecision(sorted), [sorted]);
  const curve = interpolated ? interpolatedCurve : sorted;

  const ap = useMemo(() => areaUnder(curve), [curve]);

  const linePath = useMemo(
    () =>
      curve
        .map(([recall, precision], index) => {
          const command = index === 0 ? 'M' : 'L';
          return `${command}${toX(recall).toFixed(1)},${toY(precision).toFixed(1)}`;
        })
        .join(' '),
    [curve],
  );

  const areaPath = useMemo(() => {
    const first = curve[0];
    const last = curve[curve.length - 1];
    if (!first || !last) return '';
    const start = `M${toX(first[0]).toFixed(1)},${toY(0).toFixed(1)}`;
    const top = curve
      .map(([recall, precision]) => `L${toX(recall).toFixed(1)},${toY(precision).toFixed(1)}`)
      .join(' ');
    const end = `L${toX(last[0]).toFixed(1)},${toY(0).toFixed(1)} Z`;
    return `${start} ${top} ${end}`;
  }, [curve]);

  const gridTicks = [0, 0.25, 0.5, 0.75, 1];
  const transitionClass = reduceMotion ? '' : 'transition-all duration-med ease-standard';

  return (
    <VizShell
      label={label}
      actions={
        <VizButton onClick={() => setInterpolated((v) => !v)} tone="ghost">
          {interpolated ? rawLabel : interpolateLabel}
        </VizButton>
      }
      footer={hintLabel}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="min-w-[260px] flex-1">
          <svg
            viewBox={`0 0 ${VIEW} ${VIEW}`}
            role="img"
            aria-label={`${apLabel} ${ap.toFixed(2)}`}
            className="w-full rounded-lg border border-border-base bg-surface-2"
          >
            <g className="stroke-border-base/60" strokeWidth={1}>
              {gridTicks.map((tick) => (
                <line
                  key={`gx-${tick}`}
                  x1={toX(tick)}
                  y1={PAD_TOP}
                  x2={toX(tick)}
                  y2={PAD_TOP + plotHeight}
                />
              ))}
              {gridTicks.map((tick) => (
                <line
                  key={`gy-${tick}`}
                  x1={PAD_LEFT}
                  y1={toY(tick)}
                  x2={PAD_LEFT + plotWidth}
                  y2={toY(tick)}
                />
              ))}
            </g>

            <path d={areaPath} className={cx('fill-accent/20', transitionClass)} />
            <path
              d={linePath}
              fill="none"
              className={cx('stroke-accent', transitionClass)}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {curve.map(([recall, precision], index) => (
              <circle
                key={index}
                cx={toX(recall)}
                cy={toY(precision)}
                r={2.5}
                className={cx('fill-accent', transitionClass)}
              />
            ))}

            <g className="stroke-border-strong" strokeWidth={1.5}>
              <line x1={PAD_LEFT} y1={PAD_TOP} x2={PAD_LEFT} y2={PAD_TOP + plotHeight} />
              <line
                x1={PAD_LEFT}
                y1={PAD_TOP + plotHeight}
                x2={PAD_LEFT + plotWidth}
                y2={PAD_TOP + plotHeight}
              />
            </g>

            <g className="fill-fg-subtle font-mono text-[8px]">
              {gridTicks.map((tick) => (
                <text key={`lx-${tick}`} x={toX(tick)} y={VIEW - 12} textAnchor="middle">
                  {tick.toFixed(1)}
                </text>
              ))}
              {gridTicks.map((tick) => (
                <text key={`ly-${tick}`} x={PAD_LEFT - 6} y={toY(tick) + 3} textAnchor="end">
                  {tick.toFixed(1)}
                </text>
              ))}
              <text
                x={PAD_LEFT + plotWidth / 2}
                y={VIEW - 2}
                textAnchor="middle"
                className="fill-fg-muted text-[9px]"
              >
                {recallLabel}
              </text>
              <text
                x={10}
                y={PAD_TOP + plotHeight / 2}
                textAnchor="middle"
                transform={`rotate(-90 10 ${PAD_TOP + plotHeight / 2})`}
                className="fill-fg-muted text-[9px]"
              >
                {precisionLabel}
              </text>
            </g>
          </svg>
        </div>

        <div className="flex flex-row gap-3 sm:w-[120px] sm:flex-col">
          <div className="flex-1 rounded-lg border border-border-base bg-surface p-3 text-center">
            <div className="text-[10px] uppercase tracking-widest text-fg-subtle">{apLabel}</div>
            <div className="font-mono text-3xl font-semibold tabular-nums text-accent">
              {ap.toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </VizShell>
  );
};
