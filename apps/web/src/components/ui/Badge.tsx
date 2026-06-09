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
    soft: 'bg-accent/12 text-accent',
    solid: 'bg-accent text-white',
    outline: 'text-accent border-accent/40',
  },
  success: {
    soft: 'bg-emerald-500/12 text-emerald-300',
    solid: 'bg-emerald-500 text-white',
    outline: 'text-emerald-300 border-emerald-500/40',
  },
  warning: {
    soft: 'bg-amber-500/12 text-amber-300',
    solid: 'bg-amber-500 text-white',
    outline: 'text-amber-300 border-amber-500/40',
  },
  danger: {
    soft: 'bg-rose-500/12 text-rose-300',
    solid: 'bg-rose-500 text-white',
    outline: 'text-rose-300 border-rose-500/40',
  },
  info: {
    soft: 'bg-sky-500/12 text-sky-300',
    solid: 'bg-sky-500 text-white',
    outline: 'text-sky-300 border-sky-500/40',
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
      'inline-flex items-center gap-1 rounded-pill text-[11px] font-medium tracking-snug px-2 py-0.5',
      variant === 'outline' && 'border bg-transparent',
      tones[tone][variant],
      className,
    )}
  >
    {icon}
    {children}
  </span>
);
