import { LineChart, type LineSeries } from './LineChart';

interface AreaChartProps {
  series: LineSeries[];
  title?: string | undefined;
  xLabel?: string | undefined;
  yLabel?: string | undefined;
  stacked?: boolean | undefined;
}

export const AreaChart = ({
  series,
  title = 'Area chart',
  xLabel,
  yLabel,
  stacked = false,
}: AreaChartProps) => (
  <LineChart series={series} title={title} xLabel={xLabel} yLabel={yLabel} area stacked={stacked} />
);
