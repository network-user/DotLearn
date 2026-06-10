import type { SubmissionStatus } from '@dotlearn/contracts';
import { useTranslation } from 'react-i18next';

import { cx } from '@/components/ui/cx';

interface SubmissionStatusBadgeProps {
  status: SubmissionStatus;
  className?: string;
}

const TONE: Record<SubmissionStatus, string> = {
  pending: 'text-warn border-warn/30 bg-warn/10',
  approved: 'text-accent border-accent/40 bg-accent/10',
  rejected: 'text-fg-subtle border-border-strong bg-surface-2',
  materialized: 'text-ok border-ok/40 bg-ok/10',
};

export const SubmissionStatusBadge = ({ status, className }: SubmissionStatusBadgeProps) => {
  const { t } = useTranslation('proposals');
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 text-[10px] uppercase tracking-wide border rounded-full px-2 py-0.5',
        TONE[status],
        className,
      )}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current opacity-80" />
      {t(`status.${status}`)}
    </span>
  );
};
