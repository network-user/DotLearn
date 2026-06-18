import { useEffect, useMemo, useRef, useState } from 'react';

import { m as motion, useReducedMotion } from 'framer-motion';
import { Pause, Play, RotateCcw } from 'lucide-react';

import { VizButton, VizShell } from '@/components/viz/VizShell';

export interface LandscapePoint {
  x: number;
  y: number;
}

export interface LossLandscapeProps {
  path?: LandscapePoint[];
  label?: string;
  domain?: { min: number; max: number };
  contourLevels?: number[];
  minimum?: LandscapePoint;
  stepIntervalMs?: number;
}

const width = 280;
const height = 280;
const padding = 22;

const defaultPath: LandscapePoint[] = [
  { x: -0.85, y: 0.78 },
  { x: -0.62, y: 0.5 },
  { x: -0.4, y: 0.34 },
  { x: -0.22, y: 0.18 },
  { x: -0.08, y: 0.05 },
  { x: 0.02, y: -0.04 },
  { x: 0.05, y: -0.02 },
  { x: 0.03, y: 0.01 },
];

const defaultContours = [0.12, 0.3, 0.55, 0.85];
const defaultMinimum: LandscapePoint = { x: 0, y: 0 };
const ORIGIN_POINT: LandscapePoint = { x: 0, y: 0 };

export const LossLandscape = ({
  path = defaultPath,
  label = 'Поверхность потерь',
  domain = { min: -1, max: 1 },
  contourLevels = defaultContours,
  minimum = defaultMinimum,
  stepIntervalMs = 520,
}: LossLandscapeProps) => {
  const reduceMotion = useReducedMotion();
  const [visibleSteps, setVisibleSteps] = useState(1);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<number | null>(null);

  const span = domain.max - domain.min || 1;
  const toScreenX = (x: number): number =>
    padding + ((x - domain.min) / span) * (width - padding * 2);
  const toScreenY = (y: number): number =>
    padding + ((domain.max - y) / span) * (height - padding * 2);

  const ellipses = useMemo(() => {
    const innerWidth = width - padding * 2;
    const innerHeight = height - padding * 2;
    const cx = toScreenX(minimum.x);
    const cy = toScreenY(minimum.y);
    return contourLevels.map((level) => ({
      cx,
      cy,
      rx: (innerWidth / 2) * level,
      ry: (innerHeight / 2) * level * 0.82,
    }));
  }, [contourLevels, minimum, domain]);

  const linePath = useMemo(() => {
    const shown = path.slice(0, visibleSteps);
    if (shown.length === 0) return '';
    return `M ${shown
      .map((point) => `${toScreenX(point.x).toFixed(1)},${toScreenY(point.y).toFixed(1)}`)
      .join(' L ')}`;
  }, [path, visibleSteps, domain]);

  const clearTimer = (): void => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => clearTimer, []);

  useEffect(() => {
    if (!playing) return;
    if (visibleSteps >= path.length) {
      setPlaying(false);
      return;
    }
    timerRef.current = window.setTimeout(
      () => {
        setVisibleSteps((previous) => Math.min(previous + 1, path.length));
      },
      reduceMotion ? 0 : stepIntervalMs,
    );
    return clearTimer;
  }, [playing, visibleSteps, path.length, reduceMotion, stepIntervalMs]);

  const atEnd = visibleSteps >= path.length;

  const play = (): void => {
    if (atEnd) setVisibleSteps(1);
    setPlaying(true);
  };

  const reset = (): void => {
    clearTimer();
    setPlaying(false);
    setVisibleSteps(1);
  };

  const current = path[Math.min(visibleSteps, path.length) - 1] ?? path[0] ?? ORIGIN_POINT;

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
            <VizButton onClick={play}>
              <Play size={12} />
              {atEnd ? 'Заново' : 'Пуск'}
            </VizButton>
          )}
          <VizButton
            onClick={() => {
              clearTimer();
              setPlaying(false);
              setVisibleSteps((previous) => Math.min(previous + 1, path.length));
            }}
            tone="ghost"
            disabled={atEnd}
          >
            Шаг
          </VizButton>
          <VizButton onClick={reset} tone="ghost" disabled={visibleSteps <= 1 && !playing}>
            <RotateCcw size={12} />
          </VizButton>
        </>
      }
      footer={
        <span>
          шаг {Math.min(visibleSteps, path.length)}/{path.length} · θ = (
          <span className="font-mono">{current.x.toFixed(2)}</span>,{' '}
          <span className="font-mono">{current.y.toFixed(2)}</span>)
        </span>
      }
    >
      <div className="flex justify-center overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full max-w-[320px] min-w-[240px]"
          role="img"
          aria-label="Контурная карта поверхности потерь с траекторией спуска к минимуму"
        >
          <rect
            x={padding}
            y={padding}
            width={width - padding * 2}
            height={height - padding * 2}
            rx={8}
            fill="rgb(var(--surface-2))"
            stroke="rgb(var(--border-base))"
            strokeWidth={1}
          />
          {ellipses
            .slice()
            .reverse()
            .map((ellipse, index) => (
              <ellipse
                key={index}
                cx={ellipse.cx}
                cy={ellipse.cy}
                rx={ellipse.rx}
                ry={ellipse.ry}
                fill="none"
                stroke="rgb(var(--accent-1))"
                strokeOpacity={0.18 + index * 0.12}
                strokeWidth={1}
              />
            ))}

          <motion.path
            d={linePath}
            fill="none"
            stroke="rgb(var(--accent-1))"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ opacity: 1 }}
          />

          {path.slice(0, visibleSteps).map((point, index) => (
            <circle
              key={index}
              cx={toScreenX(point.x)}
              cy={toScreenY(point.y)}
              r={index === visibleSteps - 1 ? 5 : 2.6}
              fill={index === visibleSteps - 1 ? 'rgb(var(--accent-1))' : 'rgb(var(--surface))'}
              stroke="rgb(var(--accent-1))"
              strokeWidth={1.4}
            />
          ))}

          <motion.circle
            cx={toScreenX(current.x)}
            cy={toScreenY(current.y)}
            r={5}
            fill="rgb(var(--accent-1))"
            stroke="rgb(var(--surface))"
            strokeWidth={2}
            animate={{ cx: toScreenX(current.x), cy: toScreenY(current.y) }}
            transition={
              reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 220, damping: 22 }
            }
          />

          <g>
            <line
              x1={toScreenX(minimum.x) - 5}
              y1={toScreenY(minimum.y)}
              x2={toScreenX(minimum.x) + 5}
              y2={toScreenY(minimum.y)}
              stroke="rgb(var(--ok))"
              strokeWidth={1.5}
            />
            <line
              x1={toScreenX(minimum.x)}
              y1={toScreenY(minimum.y) - 5}
              x2={toScreenX(minimum.x)}
              y2={toScreenY(minimum.y) + 5}
              stroke="rgb(var(--ok))"
              strokeWidth={1.5}
            />
          </g>
        </svg>
      </div>
    </VizShell>
  );
};
