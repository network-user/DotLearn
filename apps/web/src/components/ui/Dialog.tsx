import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

import { cx } from './cx';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizes: Record<NonNullable<DialogProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
};

export const Dialog = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  className,
}: DialogProps) => (
  <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
    <RadixDialog.Portal>
      <RadixDialog.Overlay
        className={cx(
          'fixed inset-0 z-[var(--z-modal)] bg-canvas/60 backdrop-blur-sm',
          'data-[state=open]:animate-fade-in',
        )}
      />
      <RadixDialog.Content
        className={cx(
          'fixed left-1/2 top-1/2 z-[var(--z-modal)] -translate-x-1/2 -translate-y-1/2 w-[92vw]',
          'glass glass--strong glass--bordered',
          'rounded-2xl shadow-float p-6 outline-none',
          'data-[state=open]:animate-rise',
          sizes[size],
          className,
        )}
      >
        <span aria-hidden className="glass__highlight" />
        <span aria-hidden className="glass__shine" />
        <div className="glass__content space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 min-w-0">
              {title && (
                <RadixDialog.Title className="text-lg font-semibold tracking-snug text-fg">
                  {title}
                </RadixDialog.Title>
              )}
              {description && (
                <RadixDialog.Description className="text-sm text-fg-muted">
                  {description}
                </RadixDialog.Description>
              )}
            </div>
            <RadixDialog.Close
              className="rounded-md p-1 text-fg-muted hover:bg-surface-2/60 hover:text-fg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              aria-label="Close"
            >
              <X size={16} />
            </RadixDialog.Close>
          </div>
          <div>{children}</div>
          {footer && <div className="flex justify-end gap-2 pt-2">{footer}</div>}
        </div>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  </RadixDialog.Root>
);

export { RadixDialog };
