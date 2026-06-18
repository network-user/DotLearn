import { useMemo, useState } from 'react';

import { motion, useReducedMotion } from 'framer-motion';
import { RotateCcw } from 'lucide-react';

import { VizButton, VizShell } from '@/components/viz/VizShell';

import { activationSpecs, type ActivationName } from './activations';
import { NeuralVizConfigError } from './errors';

export interface PerceptronVizProps {
  inputs?: number[];
  weights?: number[];
  bias?: number;
  activation?: ActivationName;
  label?: string;
  inputLabels?: string[];
  outputLabel?: string;
  sumLabel?: string;
  biasLabel?: string;
}

const defaultInputs = [1, 0.5, -1];
const defaultWeights = [0.6, -0.4, 0.9];

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const formatNumber = (value: number): string => {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? '0' : rounded.toFixed(2).replace(/\.?0+$/, '') || '0';
};

export const PerceptronViz = ({
  inputs = defaultInputs,
  weights = defaultWeights,
  bias = 0.2,
  activation = 'sigmoid',
  label = 'Перцептрон',
  inputLabels,
  outputLabel = 'выход',
  sumLabel = 'взвешенная сумма',
  biasLabel = 'смещение',
}: PerceptronVizProps) => {
  if (inputs.length !== weights.length) {
    throw new NeuralVizConfigError(
      `PerceptronViz: число входов (${inputs.length}) не совпадает с числом весов (${weights.length}).`,
    );
  }

  const reduceMotion = useReducedMotion();
  const [currentWeights, setCurrentWeights] = useState<number[]>(weights);
  const [currentBias, setCurrentBias] = useState<number>(bias);
  const spec = activationSpecs[activation];

  const weightedSum = useMemo(
    () =>
      inputs.reduce((sum, input, index) => sum + input * (currentWeights[index] ?? 0), 0) +
      currentBias,
    [inputs, currentWeights, currentBias],
  );

  const output = spec.apply(weightedSum);

  const reset = (): void => {
    setCurrentWeights(weights);
    setCurrentBias(bias);
  };

  const updateWeight = (index: number, value: number): void => {
    setCurrentWeights((previous) =>
      previous.map((weight, position) => (position === index ? value : weight)),
    );
  };

  const neuronCount = inputs.length;
  const viewHeight = Math.max(150, neuronCount * 46 + 30);
  const inputColumnX = 56;
  const sumX = 210;
  const outX = 332;
  const centerY = viewHeight / 2;

  const inputNodes = inputs.map((value, index) => {
    const spread = neuronCount === 1 ? 0 : (index / (neuronCount - 1) - 0.5) * (viewHeight - 56);
    return {
      value,
      y: centerY + spread,
      weight: currentWeights[index] ?? 0,
      title: inputLabels?.[index] ?? `x${index + 1}`,
    };
  });

  const activationFraction = clamp(
    (output - spec.range.min) / (spec.range.max - spec.range.min || 1),
    0,
    1,
  );

  return (
    <VizShell
      label={label}
      actions={
        <VizButton onClick={reset} tone="ghost">
          <RotateCcw size={12} />
          Сбросить
        </VizButton>
      }
      footer={
        <span>
          z = {formatNumber(weightedSum)} → {spec.label} →{' '}
          <span className="font-mono text-accent">{formatNumber(output)}</span>
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${outX + 56} ${viewHeight}`}
            className="w-full min-w-[320px]"
            role="img"
            aria-label="Схема перцептрона: входы, веса, сумма, активация, выход"
          >
            {inputNodes.map((node, index) => {
              const strength = clamp(Math.abs(node.weight) / 1.5, 0.12, 1);
              return (
                <line
                  key={`edge-${index}`}
                  x1={inputColumnX + 18}
                  y1={node.y}
                  x2={sumX - 20}
                  y2={centerY}
                  stroke={node.weight >= 0 ? 'rgb(var(--accent-1))' : 'rgb(var(--err))'}
                  strokeWidth={0.8 + strength * 2.6}
                  strokeOpacity={0.25 + strength * 0.55}
                  strokeLinecap="round"
                />
              );
            })}
            <line
              x1={sumX + 20}
              y1={centerY}
              x2={outX - 18}
              y2={centerY}
              stroke="rgb(var(--accent-1))"
              strokeWidth={1.6}
              strokeOpacity={0.5}
              strokeLinecap="round"
            />

            {inputNodes.map((node, index) => (
              <g key={`input-${index}`}>
                <circle
                  cx={inputColumnX}
                  cy={node.y}
                  r={17}
                  fill="rgb(var(--surface-2))"
                  stroke="rgb(var(--border-strong))"
                  strokeWidth={1}
                />
                <text
                  x={inputColumnX}
                  y={node.y + 4}
                  textAnchor="middle"
                  className="fill-fg font-mono"
                  fontSize={12}
                >
                  {formatNumber(node.value)}
                </text>
                <text
                  x={inputColumnX}
                  y={node.y - 24}
                  textAnchor="middle"
                  className="fill-fg-subtle font-mono"
                  fontSize={9.5}
                >
                  {node.title}
                </text>
              </g>
            ))}

            <motion.circle
              cx={sumX}
              cy={centerY}
              r={26}
              fill="rgb(var(--surface-2))"
              stroke="rgb(var(--accent-1))"
              strokeWidth={1.4}
              animate={reduceMotion ? false : { scale: [1, 1.04, 1] }}
              transition={{ duration: 0.4 }}
              key={formatNumber(weightedSum)}
              style={{ transformOrigin: `${sumX}px ${centerY}px` }}
            />
            <text
              x={sumX}
              y={centerY - 2}
              textAnchor="middle"
              className="fill-fg-subtle"
              fontSize={15}
            >
              Σ
            </text>
            <text
              x={sumX}
              y={centerY + 13}
              textAnchor="middle"
              className="fill-fg font-mono"
              fontSize={10}
            >
              {formatNumber(weightedSum)}
            </text>
            <text
              x={sumX}
              y={viewHeight - 6}
              textAnchor="middle"
              className="fill-fg-subtle"
              fontSize={9.5}
            >
              {sumLabel}
            </text>

            <circle
              cx={outX}
              cy={centerY}
              r={22}
              fill="rgb(var(--accent-1))"
              fillOpacity={0.1 + activationFraction * 0.55}
              stroke="rgb(var(--accent-1))"
              strokeWidth={1.4}
            />
            <text
              x={outX}
              y={centerY + 4}
              textAnchor="middle"
              className="fill-fg font-mono"
              fontSize={11.5}
            >
              {formatNumber(output)}
            </text>
            <text
              x={outX}
              y={centerY - 30}
              textAnchor="middle"
              className="fill-fg-subtle"
              fontSize={9.5}
            >
              {outputLabel}
            </text>
          </svg>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          {inputs.map((input, index) => (
            <label key={`weight-${index}`} className="flex flex-col gap-1">
              <span className="flex items-center justify-between text-[11px] text-fg-subtle">
                <span className="font-mono">
                  w{index + 1} · {inputLabels?.[index] ?? `x${index + 1}`}={formatNumber(input)}
                </span>
                <span className="font-mono text-fg">
                  {formatNumber(currentWeights[index] ?? 0)}
                </span>
              </span>
              <input
                type="range"
                min={-1.5}
                max={1.5}
                step={0.05}
                value={currentWeights[index] ?? 0}
                onChange={(event) => updateWeight(index, Number(event.target.value))}
                className="h-2 w-full cursor-pointer accent-[rgb(var(--accent-1))]"
                aria-label={`Вес входа ${index + 1}`}
              />
            </label>
          ))}
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="flex items-center justify-between text-[11px] text-fg-subtle">
              <span className="font-mono">{biasLabel} · b</span>
              <span className="font-mono text-fg">{formatNumber(currentBias)}</span>
            </span>
            <input
              type="range"
              min={-1.5}
              max={1.5}
              step={0.05}
              value={currentBias}
              onChange={(event) => setCurrentBias(Number(event.target.value))}
              className="h-2 w-full cursor-pointer accent-[rgb(var(--accent-1))]"
              aria-label="Смещение"
            />
          </label>
        </div>
      </div>
    </VizShell>
  );
};
