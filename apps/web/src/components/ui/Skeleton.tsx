import type { HTMLAttributes } from 'react';

import { cx } from './cx';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'pill';
}

const radii: Record<NonNullable<SkeletonProps['rounded']>, string> = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl',
  pill: 'rounded-pill',
};

export const Skeleton = ({ className, rounded = 'lg', ...rest }: SkeletonProps) => (
  <div
    aria-hidden
    {...rest}
    className={cx(
      'relative overflow-hidden border border-border-base/60 bg-surface/40',
      'before:absolute before:inset-0 before:-translate-x-full',
      'before:bg-[linear-gradient(110deg,transparent_30%,rgba(255,255,255,0.06)_46%,rgba(99,102,241,0.10)_50%,rgba(255,255,255,0.06)_54%,transparent_70%)]',
      'before:animate-[shimmer_1.6s_ease-in-out_infinite]',
      radii[rounded],
      className,
    )}
  />
);
