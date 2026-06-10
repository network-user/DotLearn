import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { cx } from './cx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
  loading?: boolean;
}

const variantClass: Record<Variant, string> = {
  primary: 'bg-accent text-surface hover:bg-accent/90 active:bg-accent/85 dark:text-canvas',
  secondary:
    'bg-surface-2/80 text-fg border border-border-strong/80 ' +
    'hover:bg-surface-3/80 hover:border-border-strong',
  ghost: 'bg-transparent text-fg-muted hover:text-fg hover:bg-surface-2/60',
  danger: 'bg-err text-surface hover:bg-err/90 dark:text-canvas',
  outline: 'bg-surface text-fg border border-border-strong hover:bg-surface-2/60',
};

const sizeClass: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-md',
  md: 'h-9 px-4 text-sm gap-2 rounded-md',
  lg: 'h-11 px-5 text-[15px] gap-2 rounded-lg',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    leadingIcon,
    trailingIcon,
    loading = false,
    disabled,
    className,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      {...rest}
      className={cx(
        'relative inline-flex items-center justify-center font-medium tracking-snug select-none',
        'transition-[transform,box-shadow,background-color,border-color,color] duration-fast ease-press-back',
        'active:scale-[0.985]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/55 focus-visible:ring-offset-0',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        sizeClass[size],
        variantClass[variant],
        className,
      )}
    >
      {loading && (
        <span
          aria-hidden
          className="absolute inset-0 grid place-items-center"
        >
          <span className="size-3.5 rounded-full border-2 border-current border-r-transparent animate-spin" />
        </span>
      )}
      <span className={cx('inline-flex items-center gap-[inherit]', loading && 'opacity-0')}>
        {leadingIcon}
        {children}
        {trailingIcon}
      </span>
    </button>
  );
});
