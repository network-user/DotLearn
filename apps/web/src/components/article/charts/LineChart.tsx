import { createLinearScale, formatTick } from './chart-scale';
import {
  AXIS_TEXT,
  CHART_H,
  CHART_MONO,
  CHART_W,
  ChartFrame,
  chartCategory,
  PAD,
} from './ChartFrame';

export interface LineSeries {
  name: string;
  points: { x: number; y: number }[];
}

interface LineChartProps {
  series: LineSeries[];
  title?: string | undefined;
  xLabel?: string | undefined;
  yLabel?: string | undefined;
  area?: boolean | undefined;
  stacked?: boolean | undefined;
}

export const LineChart = ({
  series,
  title = 'Line chart',
  xLabel,
  yLabel,
  area = false,
  stacked = false,
}: LineChartProps) => {
  const drawn = stacked
    ? series.map((entry, seriesIndex) => ({
        ...entry,
        points: entry.points.map((point, pointIndex) => ({
          x: point.x,
          y: series
            .slice(0, seriesIndex + 1)
            .reduce((sum, other) => sum + (other.points[pointIndex]?.y ?? 0), 0),
        })),
      }))
    : series;
  const allX = drawn.flatMap((entry) => entry.points.map((point) => point.x));
  const allY = drawn.flatMap((entry) => entry.points.map((point) => point.y));
  const xScale = createLinearScale(
    Math.min(...allX),
    Math.max(...allX),
    PAD.left,
    CHART_W - PAD.right,
    5,
  );
  const yScale = createLinearScale(
    Math.min(0, ...allY),
    Math.max(...allY),
    CHART_H - PAD.bottom,
    PAD.top,
  );
  const baseline = yScale(Math.max(0, yScale.ticks[0] ?? 0));

  return (
    <ChartFrame
      title={title}
      yScale={yScale}
      xLabel={xLabel}
      yLabel={yLabel}
      legend={
        series.length > 1
          ? series.map((entry, index) => ({ name: entry.name, color: chartCategory(index) }))
          : undefined
      }
    >
      {xScale.ticks.map((tick) => (
        <text
          key={tick}
          x={xScale(tick)}
          y={CHART_H - PAD.bottom + 16}
          textAnchor="middle"
          fontFamily={CHART_MONO}
          fontSize={10.5}
          fill={AXIS_TEXT}
        >
          {formatTick(tick)}
        </text>
      ))}
      {[...drawn].reverse().map((entry, reversedIndex) => {
        const index = drawn.length - 1 - reversedIndex;
        const color = chartCategory(index);
        const path = entry.points
          .map(
            (point, pointIndex) =>
              `${pointIndex === 0 ? 'M' : 'L'} ${xScale(point.x)} ${yScale(point.y)}`,
          )
          .join(' ');
        const first = entry.points[0];
        const last = entry.points[entry.points.length - 1];
        if (!first || !last) return null;
        const areaPath = `${path} L ${xScale(last.x)} ${baseline} L ${xScale(first.x)} ${baseline} Z`;
        return (
          <g key={entry.name}>
            {(area || stacked) && (
              <path d={areaPath} fill={color} style={{ opacity: 'var(--chart-area-alpha)' }} />
            )}
            <path
              d={path}
              fill="none"
              stroke={color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {entry.points.length <= 16 &&
              entry.points.map((point) => (
                <circle
                  key={`${point.x}-${point.y}`}
                  cx={xScale(point.x)}
                  cy={yScale(point.y)}
                  r={3}
                  fill={color}
                />
              ))}
          </g>
        );
      })}
    </ChartFrame>
  );
};
