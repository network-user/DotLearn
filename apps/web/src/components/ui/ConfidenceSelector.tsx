import { useTranslation } from 'react-i18next';

import { cx } from '@/components/ui/cx';
import type { ConfidenceLevel } from '@/lib/progress-db';

const LEVELS: readonly ConfidenceLevel[] = ['sure', 'unsure', 'guess'];

interface ConfidenceSelectorProps {
  value: ConfidenceLevel | null;
  onChange: (value: ConfidenceLevel | null) => void;
  disabled?: boolean | undefined;
  className?: string | undefined;
}

export const ConfidenceSelector = ({
  value,
  onChange,
  disabled,
  className,
}: ConfidenceSelectorProps) => {
  const { t } = useTranslation('runners');
  const labels: Record<ConfidenceLevel, string> = {
    sure: t('confidence.sure'),
    unsure: t('confidence.unsure'),
    guess: t('confidence.guess'),
  };
  return (
    <div className={cx('flex items-center gap-2 flex-wrap', className)}>
      <span className="text-[12.5px] text-fg-subtle">{t('confidence.prompt')}</span>
      <div
        role="radiogroup"
        aria-label={t('confidence.prompt')}
        className="flex items-center gap-1.5"
      >
        {LEVELS.map((level) => {
          const active = value === level;
          return (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(active ? null : level)}
              className={cx(
                'rounded-full border px-2.5 py-1 text-[12.5px] transition-colors duration-fast disabled:opacity-50 disabled:cursor-not-allowed',
                active
                  ? 'border-accent/55 bg-accent/10 text-fg'
                  : 'border-border-base bg-surface text-fg-subtle hover:border-border-strong hover:text-fg',
              )}
            >
              {labels[level]}
            </button>
          );
        })}
      </div>
    </div>
  );
};
