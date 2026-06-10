import { createLinearScale } from './chart-scale';
import {
  AXIS_TEXT,
  CHART_H,
  CHART_MONO,
  CHART_W,
  ChartFrame,
  chartCategory,
  PAD,
} from './ChartFrame';

interface BarDatum {
  label: string;
  value: number;
}

interface BarChartProps {
  data: BarDatum[];
  title?: string | undefined;
  unit?: string | undefined;
  highlight?: string[] | undefined;
  colorByCategory?: boolean | undefined;
}

export const BarChart = ({
  data,
  title = 'Bar chart',
  unit,
  highlight,
  colorByCategory = false,
}: BarChartProps) => {
  const maxValue = Math.max(...data.map((datum) => datum.value), 0);
  const minValue = Math.min(...data.map((datum) => datum.value), 0);
  const yScale = createLinearScale(minValue, maxValue, CHART_H - PAD.bottom, PAD.top);
  const innerW = CHART_W - PAD.left - PAD.right;
  const band = innerW / data.length;
  const barW = Math.min(56, band * 0.62);
  const zeroY = yScale(0);

  return (
    <ChartFrame title={title} yScale={yScale} yLabel={unit}>
      {data.map((datum, index) => {
        const x = PAD.left + band * index + (band - barW) / 2;
        const y = yScale(datum.value);
        const dimmed = highlight !== undefined && !highlight.includes(datum.label);
        const color = colorByCategory ? chartCategory(index) : 'rgb(var(--accent-1))';
        return (
          <g key={datum.label}>
            <rect
              x={x}
              y={Math.min(y, zeroY)}
              width={barW}
              height={Math.max(2, Math.abs(zeroY - y))}
              rx={3}
              fill={color}
              opacity={dimmed ? 0.25 : 0.88}
            />
            <text
              x={x + barW / 2}
              y={Math.min(y, zeroY) - 5}
              textAnchor="middle"
              fontFamily={CHART_MONO}
              fontSize={10.5}
              fill={dimmed ? AXIS_TEXT : 'rgb(var(--fg-muted))'}
            >
              {datum.value}
            </text>
            <text
              x={x + barW / 2}
              y={CHART_H - PAD.bottom + 16}
              textAnchor="middle"
              fontFamily={CHART_MONO}
              fontSize={10.5}
              fill={dimmed ? AXIS_TEXT : 'rgb(var(--fg))'}
            >
              {datum.label.length > 10 ? `${datum.label.slice(0, 9)}…` : datum.label}
            </text>
          </g>
        );
      })}
    </ChartFrame>
  );
};
