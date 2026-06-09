import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { cx } from './cx';

interface PressProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export const Press = forwardRef<HTMLButtonElement, PressProps>(function Press(
  { className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      {...rest}
      className={cx(
        'inline-flex items-center justify-center select-none',
        'transition-transform duration-xfast ease-press-back',
        'active:[transform:scale(var(--press-scale))]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
        className,
      )}
    >
      {children}
    </button>
  );
});
