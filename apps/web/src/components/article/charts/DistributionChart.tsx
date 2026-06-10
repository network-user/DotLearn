import { buildHistogram, createLinearScale, formatTick } from './chart-scale';
import { AXIS_TEXT, CHART_H, CHART_MONO, CHART_W, ChartFrame, PAD } from './ChartFrame';

interface DistributionMarker {
  value: number;
  label: string;
}

interface DistributionChartProps {
  values: number[];
  bins?: number | undefined;
  title?: string | undefined;
  xLabel?: string | undefined;
  markers?: DistributionMarker[] | undefined;
}

export const DistributionChart = ({
  values,
  bins = 8,
  title = 'Distribution',
  xLabel,
  markers,
}: DistributionChartProps) => {
  const histogram = buildHistogram(values, bins);
  const maxCount = Math.max(...histogram.map((bin) => bin.count), 1);
  const xScale = createLinearScale(
    Math.min(...values),
    Math.max(...values),
    PAD.left,
    CHART_W - PAD.right,
    5,
  );
  const yScale = createLinearScale(0, maxCount, CHART_H - PAD.bottom, PAD.top, 3);
  const baseline = yScale(0);

  return (
    <ChartFrame title={title} yScale={yScale} xLabel={xLabel}>
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
      {histogram.map((bin) => {
        const x = xScale(bin.x0);
        const barWidth = Math.max(2, xScale(bin.x1) - xScale(bin.x0) - 2);
        const y = yScale(bin.count);
        return (
          <rect
            key={bin.x0}
            x={x + 1}
            y={y}
            width={barWidth}
            height={Math.max(0, baseline - y)}
            rx={2}
            fill="rgb(var(--accent-1))"
            opacity={0.7}
          />
        );
      })}
      {markers?.map((marker) => (
        <g key={marker.label}>
          <line
            x1={xScale(marker.value)}
            y1={PAD.top}
            x2={xScale(marker.value)}
            y2={baseline}
            stroke="rgb(var(--viz-cat-3))"
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
          <text
            x={xScale(marker.value) + 5}
            y={PAD.top + 10}
            fontFamily={CHART_MONO}
            fontSize={10.5}
            fill="rgb(var(--viz-cat-3))"
          >
            {marker.label}
          </text>
        </g>
      ))}
    </ChartFrame>
  );
};
