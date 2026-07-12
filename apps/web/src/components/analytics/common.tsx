import type { ReactNode } from 'react';

import { cx } from '@/components/ui/cx';

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

// Local HH:MM from an epoch-ms timestamp, zero-padded, no locale/timezone surprises.
export const formatHm = (epochMs: number): string => {
  const date = new Date(epochMs);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

interface SectionProps {
  title: string;
  right?: ReactNode;
  children: ReactNode;
}

export const Section = ({ title, right, children }: SectionProps) => (
  <section className="space-y-3">
    <div className="flex items-center justify-between gap-3 border-b border-border-base pb-2">
      <h2 className="eyebrow text-fg-subtle">{title}</h2>
      {right}
    </div>
    <div className="rounded-xl border border-border-base bg-surface p-4 shadow-float sm:p-5">
      {children}
    </div>
  </section>
);

export const NoData = ({ label }: { label: string }) => (
  <div className="grid min-h-[8rem] place-items-center rounded-lg border border-dashed border-border-base/70 text-sm text-fg-subtle">
    {label}
  </div>
);

interface SegmentedOption<T extends string> {
  key: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: SegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex gap-0.5 rounded-md bg-surface-2/60 p-0.5"
    >
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          aria-pressed={value === option.key}
          onClick={() => onChange(option.key)}
          className={cx(
            'rounded px-2 py-1 text-[11px] font-medium tabular-nums transition-colors',
            value === option.key ? 'bg-surface text-fg shadow-sm' : 'text-fg-subtle hover:text-fg',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
