import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

import { cx } from './cx';

type SurfaceVariant = 'paper' | 'inset' | 'accent' | 'chrome';
type SurfaceRule = 'none' | 'top' | 'left';

interface SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  variant?: SurfaceVariant;
  rule?: SurfaceRule;
  interactive?: boolean;
  bordered?: boolean;
  children?: ReactNode;
}

const variantClass: Record<SurfaceVariant, string> = {
  paper: 'bg-surface shadow-card',
  inset: 'bg-surface-2/70',
  accent: 'bg-accent/[0.08]',
  chrome: 'glass-chrome',
};

const ruleClass: Record<SurfaceRule, string> = {
  none: '',
  top: 'border-t-2 border-t-accent',
  left: 'border-l-2 border-l-accent',
};

export const Surface = forwardRef<HTMLDivElement, SurfaceProps>(function Surface(
  {
    variant = 'paper',
    rule = 'none',
    interactive = false,
    bordered = true,
    className,
    children,
    ...rest
  },
  ref,
) {
  return (
    <div
      ref={ref}
      {...rest}
      className={cx(
        'relative rounded-2xl',
        variantClass[variant],
        bordered && 'border border-border-base',
        ruleClass[rule],
        interactive &&
          'cursor-pointer transition-[border-color,box-shadow,transform] duration-med ease-standard hover:border-border-strong hover:shadow-float hover:-translate-y-0.5 active:scale-[var(--press-scale)]',
        className,
      )}
    >
      {children}
    </div>
  );
});
