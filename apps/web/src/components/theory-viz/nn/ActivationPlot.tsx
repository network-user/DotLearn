import { useMemo, useState } from 'react';

import { m as motion, useReducedMotion } from 'framer-motion';

import { cx } from '@/components/ui/cx';

import { VizShell } from '@/components/viz/VizShell';

import { activationSpecs, softmax, type ActivationName } from './activations';

export type PlotFunction = ActivationName | 'softmax';

export interface ActivationPlotProps {
  fn?: PlotFunction;
  label?: string;
  domain?: { min: number; max: number };
  softmaxInputs?: number[];
  selectable?: boolean;
}

const plotOptions: { id: PlotFunction; label: string }[] = [
  { id: 'sigmoid', label: 'Сигмоида' },
  { id: 'tanh', label: 'Tanh' },
  { id: 'relu', label: 'ReLU' },
  { id: 'leakyRelu', label: 'Leaky ReLU' },
  { id: 'softmax', label: 'Softmax' },
];

const width = 360;
const height = 200;
const padding = 28;

const formatNumber = (value: number): string => {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? '0' : String(rounded);
};

export const ActivationPlot = ({
  fn = 'sigmoid',
  label = 'Функция активации',
  domain = { min: -5, max: 5 },
  softmaxInputs = [2, 1, 0.2, -1],
  selectable = true,
}: ActivationPlotProps) => {
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState<PlotFunction>(fn);

  const isSoftmax = active === 'softmax';
  const spec = isSoftmax ? null : activationSpecs[active];

  const curve = useMemo(() => {
    if (spec === null) return { path: '', yMin: 0, yMax: 1 };
    const samples = 96;
    const points: { x: number; y: number }[] = [];
    for (let index = 0; index <= samples; index += 1) {
      const x = domain.min + (index / samples) * (domain.max - domain.min);
      points.push({ x, y: spec.apply(x) });
    }
    const yMin = Math.min(spec.range.min, ...points.map((point) => point.y));
    const yMax = Math.max(spec.range.max, ...points.map((point) => point.y));
    const span = yMax - yMin || 1;
    const toScreen = (point: { x: number; y: number }): string => {
      const sx =
        padding + ((point.x - domain.min) / (domain.max - domain.min)) * (width - padding * 2);
      const sy = height - padding - ((point.y - yMin) / span) * (height - padding * 2);
      return `${sx.toFixed(1)},${sy.toFixed(1)}`;
    };
    return { path: `M ${points.map(toScreen).join(' L ')}`, yMin, yMax };
  }, [spec, domain]);

  const softmaxResult = useMemo(() => softmax(softmaxInputs), [softmaxInputs]);

  const zeroY = (() => {
    if (spec === null) return 0;
    const span = curve.yMax - curve.yMin || 1;
    return height - padding - ((0 - curve.yMin) / span) * (height - padding * 2);
  })();

  const zeroX = padding + ((0 - domain.min) / (domain.max - domain.min)) * (width - padding * 2);

  return (
    <VizShell
      label={label}
      actions={
        selectable ? (
          <div className="flex flex-wrap items-center gap-0.5 rounded-lg border border-border-base bg-surface p-0.5">
            {plotOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setActive(option.id)}
                className={cx(
                  'rounded-md px-2 h-7 text-[11px] font-medium transition-colors duration-fast',
                  active === option.id
                    ? 'bg-accent text-surface dark:text-canvas'
                    : 'text-fg-muted hover:text-fg',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : undefined
      }
      footer={
        isSoftmax
          ? 'Softmax превращает вектор в распределение вероятностей: значения положительны и в сумме дают 1.'
          : `Область значений: [${formatNumber(spec?.range.min ?? 0)}, ${formatNumber(spec?.range.max ?? 1)}]`
      }
    >
      {isSoftmax ? (
        <div className="flex flex-col gap-2.5">
          {softmaxInputs.map((input, index) => {
            const probability = softmaxResult[index] ?? 0;
            return (
              <div key={index} className="flex items-center gap-3">
                <span className="w-16 shrink-0 font-mono text-[12px] text-fg-subtle">
                  z{index + 1}={formatNumber(input)}
                </span>
                <div className="relative h-6 flex-1 overflow-hidden rounded-md bg-surface-2">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-md bg-accent/70"
                    initial={reduceMotion ? false : { width: 0 }}
                    animate={{ width: `${probability * 100}%` }}
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { type: 'spring', stiffness: 220, damping: 30 }
                    }
                  />
                </div>
                <span className="w-14 shrink-0 text-right font-mono text-[12px] text-accent">
                  {(probability * 100).toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full min-w-[300px]"
            role="img"
            aria-label={`График функции активации ${spec?.label}`}
          >
            <line
              x1={padding}
              y1={zeroY}
              x2={width - padding}
              y2={zeroY}
              stroke="rgb(var(--border-strong))"
              strokeWidth={1}
            />
            <line
              x1={zeroX}
              y1={padding}
              x2={zeroX}
              y2={height - padding}
              stroke="rgb(var(--border-strong))"
              strokeWidth={1}
            />
            <motion.path
              d={curve.path}
              fill="none"
              stroke="rgb(var(--accent-1))"
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduceMotion ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.7, ease: 'easeOut' }}
              key={active}
            />
            <text
              x={width - padding}
              y={zeroY - 6}
              textAnchor="end"
              className="fill-fg-subtle font-mono"
              fontSize={9}
            >
              x
            </text>
            <text x={zeroX + 6} y={padding + 4} className="fill-fg-subtle font-mono" fontSize={9}>
              f(x)
            </text>
          </svg>
        </div>
      )}
    </VizShell>
  );
};
