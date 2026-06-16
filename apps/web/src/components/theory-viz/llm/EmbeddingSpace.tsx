import { useMemo, useState } from 'react';

import { motion, useReducedMotion } from 'framer-motion';

import { cx } from '@/components/ui/cx';
import { VizShell } from '@/components/viz/VizShell';

export type EmbeddingPoint = [number, number, string];

export interface EmbeddingSpaceProps {
  points?: EmbeddingPoint[];
  label?: string;
  emptyHint?: string;
}

interface PlacedPoint {
  x: number;
  y: number;
  label: string;
  cluster: number;
}

const defaultPoints: EmbeddingPoint[] = [
  [0.18, 0.22, 'король'],
  [0.24, 0.16, 'королева'],
  [0.14, 0.3, 'принц'],
  [0.27, 0.28, 'трон'],
  [0.72, 0.2, 'кошка'],
  [0.8, 0.26, 'собака'],
  [0.76, 0.12, 'хомяк'],
  [0.68, 0.3, 'попугай'],
  [0.4, 0.78, 'река'],
  [0.5, 0.84, 'озеро'],
  [0.34, 0.86, 'море'],
  [0.46, 0.7, 'дождь'],
];

const palette = [
  '--viz-cat-1',
  '--viz-cat-2',
  '--viz-cat-3',
  '--viz-cat-4',
  '--viz-cat-5',
  '--viz-cat-6',
];

const distance = (a: EmbeddingPoint, b: EmbeddingPoint): number =>
  Math.hypot(a[0] - b[0], a[1] - b[1]);

const assignClusters = (points: EmbeddingPoint[]): number[] => {
  const clusters: number[] = points.map(() => -1);
  let next = 0;
  const threshold = 0.18;
  points.forEach((origin, i) => {
    if (clusters[i] !== -1) return;
    clusters[i] = next;
    points.forEach((candidate, j) => {
      if (j > i && clusters[j] === -1 && distance(origin, candidate) < threshold) {
        clusters[j] = next;
      }
    });
    next += 1;
  });
  return clusters;
};

const VIEW = 320;
const PADDING = 28;

export const EmbeddingSpace = ({
  points = defaultPoints,
  label = 'Пространство эмбеддингов',
  emptyHint = 'Похожие по смыслу слова лежат рядом. Наведите на точку.',
}: EmbeddingSpaceProps) => {
  const reduceMotion = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);

  const placed = useMemo<PlacedPoint[]>(() => {
    const clusters = assignClusters(points);
    const scale = (value: number): number => PADDING + value * (VIEW - PADDING * 2);
    return points.map((point, index) => ({
      x: scale(point[0]),
      y: scale(point[1]),
      label: point[2],
      cluster: clusters[index] ?? 0,
    }));
  }, [points]);

  const hovered = hover !== null ? placed[hover] ?? null : null;

  return (
    <VizShell
      label={label}
      footer={
        hovered ? (
          <span>
            <span className="font-mono text-accent">{hovered.label}</span>
            <span className="text-fg-subtle"> · кластер </span>
            <span className="font-mono tabular-nums">{hovered.cluster + 1}</span>
          </span>
        ) : (
          emptyHint
        )
      }
    >
      <div className="mx-auto w-full max-w-[420px]">
        <svg
          viewBox={`0 0 ${VIEW} ${VIEW}`}
          className="block w-full"
          role="img"
          aria-label={label}
        >
          <defs>
            <pattern id="embed-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path
                d="M 32 0 L 0 0 0 32"
                fill="none"
                stroke="rgb(var(--border) / 0.5)"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width={VIEW} height={VIEW} fill="url(#embed-grid)" rx="10" />

          {placed.map((point, index) => {
            const colorVar = palette[point.cluster % palette.length] ?? '--accent-1';
            const color = `rgb(var(${colorVar}))`;
            const isHover = hover === index;
            const dim = hovered !== null && hovered.cluster !== point.cluster;
            return (
              <g
                key={`${point.label}-${index}`}
                transform={`translate(${point.x} ${point.y})`}
                className="cursor-pointer"
                onMouseEnter={() => setHover(index)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setHover(isHover ? null : index)}
                tabIndex={0}
                onFocus={() => setHover(index)}
                onBlur={() => setHover(null)}
                role="button"
                aria-label={point.label}
              >
                <motion.circle
                  r={isHover ? 8 : 5}
                  fill={color}
                  initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: dim ? 0.3 : 1 }}
                  transition={{
                    delay: reduceMotion ? 0 : Math.min(index * 0.03, 0.5),
                    type: 'spring',
                    stiffness: 360,
                    damping: 24,
                  }}
                />
                <text
                  x={9}
                  y={4}
                  className={cx(
                    'pointer-events-none select-none font-mono',
                    isHover ? 'fill-[rgb(var(--fg))]' : 'fill-[rgb(var(--fg-muted))]',
                  )}
                  style={{ fontSize: 11, opacity: dim ? 0.3 : 1 }}
                >
                  {point.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </VizShell>
  );
};
