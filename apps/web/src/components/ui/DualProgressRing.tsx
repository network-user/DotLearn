import type { ReactNode } from 'react';

import { cx } from './cx';

interface DualProgressRingProps {
  reading: number;
  solving: number;
  size?: number;
  stroke?: number;
  gap?: number;
  label?: ReactNode;
  ariaLabel?: string;
  className?: string;
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

interface ArcProps {
  size: number;
  radius: number;
  stroke: number;
  value: number;
  indicatorClassName: string;
}

const Arc = ({ size, radius, stroke, value, indicatorClassName }: ArcProps) => {
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamp01(value));
  return (
    <>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        className="text-surface-3 opacity-60"
        stroke="currentColor"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        stroke="currentColor"
        className={cx('transition-[stroke-dashoffset] duration-slow ease-out', indicatorClassName)}
      />
    </>
  );
};

export const DualProgressRing = ({
  reading,
  solving,
  size = 56,
  stroke = 4,
  gap = 3,
  label,
  ariaLabel,
  className,
}: DualProgressRingProps) => {
  const outerRadius = (size - stroke) / 2;
  const innerRadius = outerRadius - stroke - gap;
  return (
    <div
      className={cx('relative inline-grid place-items-center', className)}
      style={{ width: size, height: size }}
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="-rotate-90">
        <Arc size={size} radius={outerRadius} stroke={stroke} value={reading} indicatorClassName="text-accent/45" />
        <Arc size={size} radius={innerRadius} stroke={stroke} value={solving} indicatorClassName="text-accent" />
      </svg>
      {label !== undefined && (
        <span className="absolute inset-0 grid place-items-center text-[11px] font-semibold tabular-nums tracking-tight">
          {label}
        </span>
      )}
    </div>
  );
};
