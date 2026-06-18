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
      'inline-flex items-center gap-4 border-b border-border-base',
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
      'relative -mb-px inline-flex items-center gap-1.5 border-b-2 border-transparent px-1 py-2.5 sm:py-2 text-[13px] font-medium tracking-snug text-fg-muted',
      'transition-colors duration-fast hover:text-fg',
      'data-[state=active]:border-accent data-[state=active]:text-fg',
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
