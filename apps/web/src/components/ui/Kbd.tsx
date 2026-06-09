import type { HTMLAttributes, ReactNode } from 'react';

import { cx } from './cx';

interface KbdProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
}

export const Kbd = ({ className, children, ...rest }: KbdProps) => (
  <kbd
    {...rest}
    className={cx(
      'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1',
      'rounded border border-border-strong/80 bg-surface-2/80 text-[10px] font-mono text-fg-muted',
      'shadow-[inset_0_-1px_0_rgba(0,0,0,0.18)]',
      className,
    )}
  >
    {children}
  </kbd>
);
