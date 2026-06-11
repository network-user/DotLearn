import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cx } from '@/components/ui/cx';

export interface TemplateOption {
  id: string;
  label: string;
  description: string;
}

interface TemplatePickerProps {
  options: TemplateOption[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export const TemplatePicker = ({ options, selectedId, onSelect }: TemplatePickerProps) => {
  const { t } = useTranslation('sandbox');
  return (
    <div
      role="radiogroup"
      aria-label={t('templates.groupLabel')}
      className="grid grid-cols-1 gap-2 sm:grid-cols-2"
    >
      {options.map((option) => {
        const active = option.id === selectedId;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSelect(option.id)}
            className={cx(
              'group relative flex min-h-[var(--tap)] flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left',
              'transition-[border-color,background-color] duration-fast',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
              active
                ? 'border-accent/60 bg-accent/[0.08]'
                : 'border-border-base bg-surface hover:border-border-strong hover:bg-surface-2/40',
            )}
          >
            <span className="flex w-full items-center justify-between gap-2">
              <span
                className={cx(
                  'text-[13px] font-medium tracking-snug',
                  active ? 'text-fg' : 'text-fg-muted group-hover:text-fg',
                )}
              >
                {option.label}
              </span>
              {active && <Check size={14} className="shrink-0 text-accent" aria-hidden />}
            </span>
            <span className="text-[12px] leading-snug text-fg-subtle">{option.description}</span>
          </button>
        );
      })}
    </div>
  );
};
