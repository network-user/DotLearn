export interface LinearScale {
  (value: number): number;
  ticks: number[];
}

const niceStep = (rawStep: number): number => {
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const residual = rawStep / magnitude;
  if (residual <= 1) return magnitude;
  if (residual <= 2) return 2 * magnitude;
  if (residual <= 5) return 5 * magnitude;
  return 10 * magnitude;
};

export const createLinearScale = (
  domainMin: number,
  domainMax: number,
  rangeMin: number,
  rangeMax: number,
  tickCount = 4,
): LinearScale => {
  const span = domainMax - domainMin || 1;
  const step = niceStep(span / tickCount);
  const niceMin = Math.floor(domainMin / step) * step;
  const niceMax = Math.ceil(domainMax / step) * step;
  const niceSpan = niceMax - niceMin || 1;
  const scale = ((value: number) =>
    rangeMin + ((value - niceMin) / niceSpan) * (rangeMax - rangeMin)) as LinearScale;
  const ticks: number[] = [];
  for (let tick = niceMin; tick <= niceMax + step / 2; tick += step) {
    ticks.push(Number(tick.toFixed(10)));
  }
  scale.ticks = ticks;
  return scale;
};

export const formatTick = (value: number): string => {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${Number(value.toFixed(4))}`;
};

export const buildHistogram = (
  values: number[],
  binCount: number,
): { x0: number; x1: number; count: number }[] => {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const bins = Array.from({ length: binCount }, (_, index) => ({
    x0: min + (span / binCount) * index,
    x1: min + (span / binCount) * (index + 1),
    count: 0,
  }));
  for (const value of values) {
    const index = Math.min(binCount - 1, Math.floor(((value - min) / span) * binCount));
    const bin = bins[index];
    if (bin) bin.count += 1;
  }
  return bins;
};
