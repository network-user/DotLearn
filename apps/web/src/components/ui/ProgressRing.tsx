import type { ReactNode } from 'react';

import { cx } from './cx';

interface ProgressRingProps {
  value: number;
  size?: number;
  stroke?: number;
  className?: string;
  trackClassName?: string;
  indicatorClassName?: string;
  label?: ReactNode;
  ariaLabel?: string;
}

export const ProgressRing = ({
  value,
  size = 56,
  stroke = 6,
  className,
  trackClassName = 'text-surface-3',
  indicatorClassName = 'text-accent',
  label,
  ariaLabel,
}: ProgressRingProps) => {
  const clamped = Math.max(0, Math.min(1, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped);
  return (
    <div
      className={cx('relative inline-grid place-items-center', className)}
      style={{ width: size, height: size }}
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className={cx('opacity-60', trackClassName)}
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
      </svg>
      {label !== undefined && (
        <span className="absolute inset-0 grid place-items-center text-[11px] font-semibold tabular-nums tracking-tight">
          {label}
        </span>
      )}
    </div>
  );
};
