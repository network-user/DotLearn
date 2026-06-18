import { useEffect, useMemo, useRef, useState } from 'react';

import { m as motion, useReducedMotion } from 'framer-motion';
import { Pause, Play, RotateCcw } from 'lucide-react';

import { cx } from '@/components/ui/cx';

import { VizButton, VizShell } from '@/components/viz/VizShell';

export interface LossFunction1D {
  value: (x: number) => number;
  gradient: (x: number) => number;
  domain: { min: number; max: number };
}

export interface GradientDescentVizProps {
  fn?: LossFunction1D;
  lr?: number;
  startX?: number;
  label?: string;
  stepIntervalMs?: number;
}

const defaultFn: LossFunction1D = {
  value: (x) => 0.18 * x * x - 0.4 * Math.cos(2 * x) + 0.4,
  gradient: (x) => 0.36 * x + 0.8 * Math.sin(2 * x),
  domain: { min: -4.5, max: 4.5 },
};

const width = 380;
const height = 220;
const padding = 26;

const presetRates = [0.05, 0.2, 0.6, 1.1];

const formatNumber = (value: number): string => {
  const rounded = Math.round(value * 1000) / 1000;
  return Object.is(rounded, -0) ? '0' : String(rounded);
};

export const GradientDescentViz = ({
  fn = defaultFn,
  lr = 0.2,
  startX = -4,
  label = 'Градиентный спуск',
  stepIntervalMs = 650,
}: GradientDescentVizProps) => {
  const reduceMotion = useReducedMotion();
  const [learningRate, setLearningRate] = useState(lr);
  const [positionX, setPositionX] = useState(startX);
  const [stepCount, setStepCount] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<number | null>(null);

  const sampled = useMemo(() => {
    const samples = 100;
    const points: { x: number; y: number }[] = [];
    for (let index = 0; index <= samples; index += 1) {
      const x = fn.domain.min + (index / samples) * (fn.domain.max - fn.domain.min);
      points.push({ x, y: fn.value(x) });
    }
    const yMin = Math.min(...points.map((point) => point.y));
    const yMax = Math.max(...points.map((point) => point.y));
    return { points, yMin, yMax };
  }, [fn]);

  const span = sampled.yMax - sampled.yMin || 1;

  const toScreenX = (x: number): number =>
    padding + ((x - fn.domain.min) / (fn.domain.max - fn.domain.min)) * (width - padding * 2);
  const toScreenY = (y: number): number =>
    height - padding - ((y - sampled.yMin) / span) * (height - padding * 2);

  const curvePath = useMemo(
    () =>
      `M ${sampled.points
        .map((point) => `${toScreenX(point.x).toFixed(1)},${toScreenY(point.y).toFixed(1)}`)
        .join(' L ')}`,
    [sampled],
  );

  const clamp = (value: number): number => Math.min(fn.domain.max, Math.max(fn.domain.min, value));

  const clearTimer = (): void => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => clearTimer, []);

  const advance = (): void => {
    setPositionX((previous) => clamp(previous - learningRate * fn.gradient(previous)));
    setStepCount((previous) => previous + 1);
  };

  useEffect(() => {
    if (!playing) return;
    if (stepCount >= 60) {
      setPlaying(false);
      return;
    }
    timerRef.current = window.setTimeout(advance, reduceMotion ? 0 : stepIntervalMs);
    return clearTimer;
  }, [playing, stepCount, learningRate, reduceMotion, stepIntervalMs]);

  const reset = (): void => {
    clearTimer();
    setPlaying(false);
    setPositionX(startX);
    setStepCount(0);
  };

  const gradient = fn.gradient(positionX);
  const ballX = toScreenX(positionX);
  const ballY = toScreenY(fn.value(positionX));
  const diverging = Math.abs(positionX) >= fn.domain.max - 0.05 && Math.abs(gradient) > 0.05;

  return (
    <VizShell
      label={label}
      actions={
        <>
          {playing ? (
            <VizButton onClick={() => setPlaying(false)} tone="ghost">
              <Pause size={12} />
              Пауза
            </VizButton>
          ) : (
            <VizButton
              onClick={() => {
                if (stepCount >= 60) reset();
                setPlaying(true);
              }}
            >
              <Play size={12} />
              Пуск
            </VizButton>
          )}
          <VizButton
            onClick={() => {
              clearTimer();
              setPlaying(false);
              advance();
            }}
            tone="ghost"
          >
            Шаг
          </VizButton>
          <VizButton onClick={reset} tone="ghost" disabled={stepCount === 0}>
            <RotateCcw size={12} />
          </VizButton>
        </>
      }
      footer={
        diverging ? (
          <span className="text-warn">
            Слишком большая скорость обучения — шаги перелетают минимум и расходятся.
          </span>
        ) : (
          <span>
            шаг {stepCount} · x = {formatNumber(positionX)} · градиент ={' '}
            <span className="font-mono">{formatNumber(gradient)}</span> · потеря ={' '}
            <span className="font-mono text-accent">{formatNumber(fn.value(positionX))}</span>
          </span>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full min-w-[320px]"
            role="img"
            aria-label="Кривая функции потерь с шариком, скатывающимся в минимум"
          >
            <path
              d={`${curvePath} L ${toScreenX(fn.domain.max)},${height - padding} L ${toScreenX(
                fn.domain.min,
              )},${height - padding} Z`}
              fill="rgb(var(--accent-1))"
              fillOpacity={0.06}
            />
            <path
              d={curvePath}
              fill="none"
              stroke="rgb(var(--accent-1))"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <line
              x1={ballX}
              y1={ballY}
              x2={ballX}
              y2={height - padding}
              stroke="rgb(var(--border-strong))"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <motion.circle
              cx={ballX}
              cy={ballY}
              r={7}
              fill="rgb(var(--accent-1))"
              stroke="rgb(var(--surface))"
              strokeWidth={2}
              animate={{ cx: ballX, cy: ballY }}
              transition={
                reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 200, damping: 18 }
              }
            />
          </svg>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="flex items-center justify-between text-[11px] text-fg-subtle">
            <span className="font-mono">скорость обучения · lr</span>
            <span className="font-mono text-fg">{formatNumber(learningRate)}</span>
          </span>
          <input
            type="range"
            min={0.02}
            max={1.2}
            step={0.02}
            value={learningRate}
            onChange={(event) => setLearningRate(Number(event.target.value))}
            className="h-2 w-full cursor-pointer accent-[rgb(var(--accent-1))]"
            aria-label="Скорость обучения"
          />
          <div className="flex flex-wrap gap-1.5">
            {presetRates.map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() => setLearningRate(rate)}
                className={cx(
                  'min-h-[var(--tap)] sm:min-h-0 rounded-md border border-border-base px-2.5 py-1 font-mono text-[11.5px] transition-colors duration-fast',
                  Math.abs(learningRate - rate) < 0.001
                    ? 'border-accent/60 bg-accent/12 text-accent'
                    : 'text-fg-muted hover:border-accent/40 hover:text-fg',
                )}
              >
                lr={rate}
              </button>
            ))}
          </div>
        </label>
      </div>
    </VizShell>
  );
};
