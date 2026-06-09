import * as RadixTooltip from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';

import { cx } from './cx';

interface TooltipProps {
  content: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  children: ReactNode;
  delayDuration?: number;
  className?: string;
}

export const Tooltip = ({
  content,
  side = 'top',
  align = 'center',
  children,
  delayDuration = 200,
  className,
}: TooltipProps) => (
  <RadixTooltip.Provider delayDuration={delayDuration}>
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          align={align}
          sideOffset={6}
          className={cx(
            'z-[var(--z-tooltip)] rounded-md bg-fg/95 text-canvas px-2 py-1 text-xs shadow-float',
            'data-[state=delayed-open]:animate-fade-in',
            className,
          )}
        >
          {content}
          <RadixTooltip.Arrow className="fill-fg/95" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  </RadixTooltip.Provider>
);
