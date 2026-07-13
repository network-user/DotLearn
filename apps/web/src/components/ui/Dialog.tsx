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
  placement?: 'center' | 'sheet';
  className?: string;
}

const sizes: Record<NonNullable<DialogProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
};

const sheetSizes: Record<NonNullable<DialogProps['size']>, string> = {
  sm: 'md:max-w-sm',
  md: 'md:max-w-md',
  lg: 'md:max-w-2xl',
};

export const Dialog = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = 'md',
  placement = 'center',
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
          'fixed z-[var(--z-modal)]',
          'bg-surface border border-border-base',
          'p-6 outline-none',
          'data-[state=open]:animate-rise',
          placement === 'center'
            ? cx(
                // Центрируем через CSS-свойство translate, а не transform: keyframe
                // rise анимирует transform (translateY), и при transform-центрировании
                // он затирал -50%,-50% - окно прыгало из угла в центр при появлении.
                'left-1/2 top-1/2 [translate:-50%_-50%] w-[92vw] max-h-[88vh] overflow-y-auto rounded-xl shadow-float',
                sizes[size],
              )
            : cx(
                'inset-x-0 bottom-0 w-full max-h-[85dvh] overflow-y-auto overscroll-contain',
                'rounded-t-xl rounded-b-none shadow-sheet pb-[calc(24px+var(--safe-bottom))]',
                'md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:[translate:-50%_-50%]',
                'md:w-[92vw] md:max-h-[88vh] md:overflow-y-auto md:rounded-xl md:shadow-float md:pb-6',
                sheetSizes[size],
              ),
          className,
        )}
      >
        <div className="space-y-4">
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
