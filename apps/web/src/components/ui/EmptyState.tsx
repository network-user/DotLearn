import { type ReactNode } from 'react';

import { Surface } from './Surface';
import { cx } from './cx';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  body?: ReactNode;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
}

export const EmptyState = ({
  icon,
  title,
  body,
  primaryAction,
  secondaryAction,
  className,
}: EmptyStateProps) => {
  const hasActions = Boolean(primaryAction || secondaryAction);
  return (
    <Surface variant="inset" className={cx('p-8 text-center sm:p-10', className)}>
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
        {icon && (
          <span className="grid size-12 place-items-center rounded-full bg-surface-2/60 text-fg-subtle">
            {icon}
          </span>
        )}
        <h3 className="font-display text-xl tracking-tightish text-fg">{title}</h3>
        {body && <p className="text-sm leading-relaxed text-fg-muted">{body}</p>}
        {hasActions && (
          <div className="mt-3 flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-center">
            {primaryAction}
            {secondaryAction}
          </div>
        )}
      </div>
    </Surface>
  );
};
