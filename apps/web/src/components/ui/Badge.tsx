import type { HTMLAttributes, ReactNode } from 'react';

import { cx } from './cx';

type Tone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
type Variant = 'soft' | 'solid' | 'outline';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  variant?: Variant;
  icon?: ReactNode;
  children: ReactNode;
}

const tones: Record<Tone, { soft: string; solid: string; outline: string }> = {
  neutral: {
    soft: 'bg-surface-2/80 text-fg-muted',
    solid: 'bg-surface-3 text-fg',
    outline: 'text-fg-muted border-border-strong',
  },
  accent: {
    soft: 'bg-accent/10 text-accent',
    solid: 'bg-accent text-surface dark:text-canvas',
    outline: 'text-accent border-accent/40',
  },
  success: {
    soft: 'bg-ok/10 text-ok',
    solid: 'bg-ok text-surface dark:text-canvas',
    outline: 'text-ok border-ok/40',
  },
  warning: {
    soft: 'bg-warn/10 text-warn',
    solid: 'bg-warn text-surface dark:text-canvas',
    outline: 'text-warn border-warn/40',
  },
  danger: {
    soft: 'bg-err/10 text-err',
    solid: 'bg-err text-surface dark:text-canvas',
    outline: 'text-err border-err/40',
  },
  info: {
    soft: 'bg-info/10 text-info',
    solid: 'bg-info text-surface dark:text-canvas',
    outline: 'text-info border-info/40',
  },
};

export const Badge = ({
  tone = 'neutral',
  variant = 'soft',
  icon,
  className,
  children,
  ...rest
}: BadgeProps) => (
  <span
    {...rest}
    className={cx(
      'inline-flex items-center gap-1 rounded-xs text-[11px] font-semibold uppercase tracking-[var(--ls-wide)] px-1.5 py-0.5',
      variant === 'outline' && 'border bg-transparent',
      tones[tone][variant],
      className,
    )}
  >
    {icon}
    {children}
  </span>
);
