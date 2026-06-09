import * as RadixTabs from '@radix-ui/react-tabs';
import type { ReactNode } from 'react';

import { cx } from './cx';

interface TabsRootProps extends RadixTabs.TabsProps {
  className?: string;
  children: ReactNode;
}

export const Tabs = ({ className, children, ...rest }: TabsRootProps) => (
  <RadixTabs.Root {...rest} className={cx('flex flex-col gap-3 min-w-0', className)}>
    {children}
  </RadixTabs.Root>
);

interface TabsListProps {
  className?: string;
  children: ReactNode;
}

export const TabsList = ({ className, children }: TabsListProps) => (
  <RadixTabs.List
    className={cx(
      'inline-flex items-center gap-1 rounded-pill border border-border-base bg-surface/40 p-1 backdrop-blur-soft',
      'self-start',
      className,
    )}
  >
    {children}
  </RadixTabs.List>
);

interface TabsTriggerProps {
  value: string;
  className?: string;
  children: ReactNode;
}

export const TabsTrigger = ({ value, className, children }: TabsTriggerProps) => (
  <RadixTabs.Trigger
    value={value}
    className={cx(
      'relative inline-flex items-center gap-1.5 rounded-pill px-3 py-2.5 sm:py-1 text-[13px] font-medium tracking-snug text-fg-muted',
      'transition-colors duration-fast hover:text-fg',
      'data-[state=active]:bg-surface data-[state=active]:text-fg data-[state=active]:shadow-card',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
      className,
    )}
  >
    {children}
  </RadixTabs.Trigger>
);

interface TabsContentProps {
  value: string;
  className?: string;
  children: ReactNode;
}

export const TabsContent = ({ value, className, children }: TabsContentProps) => (
  <RadixTabs.Content
    value={value}
    className={cx('outline-none data-[state=active]:animate-fade-in', className)}
  >
    {children}
  </RadixTabs.Content>
);
