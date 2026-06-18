import type { ReactNode } from 'react';

import { formatTick, type LinearScale } from './chart-scale';

export const CHART_W = 520;
export const CHART_H = 260;
export const PAD = { top: 16, right: 16, bottom: 40, left: 48 };

export const CHART_FONT = 'var(--font-stack-system)';
export const CHART_MONO = 'var(--font-stack-mono)';
export const GRID = 'rgb(var(--chart-grid))';
export const AXIS_TEXT = 'rgb(var(--fg-subtle))';

export const chartCategory = (index: number): string => `rgb(var(--viz-cat-${(index % 6) + 1}))`;

interface ChartFrameProps {
  title: string;
  yScale: LinearScale;
  xLabel?: string | undefined;
  yLabel?: string | undefined;
  legend?: { name: string; color: string }[] | undefined;
  children: ReactNode;
}

export const ChartFrame = ({
  title,
  yScale,
  xLabel,
  yLabel,
  legend,
  children,
}: ChartFrameProps) => (
  <svg
    viewBox={`0 0 ${CHART_W} ${CHART_H + (legend ? 26 : 0)}`}
    role="img"
    aria-label={title}
    className="block w-full mx-auto"
    style={{ maxWidth: 560 }}
  >
    <title>{title}</title>
    {yScale.ticks.map((tick) => (
      <g key={tick}>
        <line
          x1={PAD.left}
          y1={yScale(tick)}
          x2={CHART_W - PAD.right}
          y2={yScale(tick)}
          stroke={GRID}
          strokeWidth={1}
        />
        <text
          x={PAD.left - 8}
          y={yScale(tick) + 3.5}
          textAnchor="end"
          fontFamily={CHART_MONO}
          fontSize={10.5}
          fill={AXIS_TEXT}
        >
          {formatTick(tick)}
        </text>
      </g>
    ))}
    {yLabel && (
      <text
        x={PAD.left}
        y={PAD.top - 5}
        textAnchor="start"
        fontFamily={CHART_FONT}
        fontSize={10.5}
        fill={AXIS_TEXT}
      >
        {yLabel}
      </text>
    )}
    {xLabel && (
      <text
        x={(PAD.left + CHART_W - PAD.right) / 2}
        y={CHART_H - 4}
        textAnchor="middle"
        fontFamily={CHART_FONT}
        fontSize={11}
        fill={AXIS_TEXT}
      >
        {xLabel}
      </text>
    )}
    {children}
    {legend && (
      <g>
        {legend.map((entry, index) => {
          const x = PAD.left + index * 130;
          return (
            <g key={entry.name}>
              <rect x={x} y={CHART_H + 8} width={10} height={10} rx={2} fill={entry.color} />
              <text
                x={x + 16}
                y={CHART_H + 17}
                fontFamily={CHART_FONT}
                fontSize={11.5}
                fill="rgb(var(--fg-muted))"
              >
                {entry.name}
              </text>
            </g>
          );
        })}
      </g>
    )}
  </svg>
);
