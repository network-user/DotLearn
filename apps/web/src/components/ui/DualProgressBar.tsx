import { cx } from './cx';

interface DualProgressBarProps {
  reading: number;
  solving: number;
  className?: string;
  ariaLabel?: string;
}

const pct = (value: number): number => Math.round(Math.max(0, Math.min(1, value)) * 100);

export const DualProgressBar = ({
  reading,
  solving,
  className,
  ariaLabel,
}: DualProgressBarProps) => (
  <div
    className={cx('relative h-1.5 rounded-full bg-surface-2 overflow-hidden', className)}
    role="progressbar"
    aria-label={ariaLabel}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={pct(solving)}
  >
    <div
      className="absolute inset-y-0 left-0 bg-accent/30 transition-[width] duration-slow"
      style={{ width: `${pct(reading)}%` }}
    />
    <div
      className="absolute inset-y-0 left-0 bg-accent transition-[width] duration-slow"
      style={{ width: `${pct(solving)}%` }}
    />
  </div>
);
