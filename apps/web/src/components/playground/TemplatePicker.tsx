import { ArrowRight, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cx } from '@/components/ui/cx';

export interface TemplateOption {
  id: string;
  label: string;
  description: string;
}

interface TemplatePickerProps {
  options: TemplateOption[];
  onOpen: (id: string) => void;
  icon: LucideIcon;
}

export const TemplatePicker = ({ options, onOpen, icon: Icon }: TemplatePickerProps) => {
  const { t } = useTranslation('sandbox');
  return (
    <ul
      aria-label={t('templates.groupLabel')}
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      {options.map((option) => (
        <li key={option.id} className="min-w-0">
          <button
            type="button"
            onClick={() => onOpen(option.id)}
            className={cx(
              'group flex h-full w-full flex-col items-start gap-2 rounded-xl border px-4 py-3.5 text-left',
              'min-h-[var(--tap-comfort)] transition-[border-color,background-color,transform] duration-fast',
              'border-border-base bg-surface hover:border-accent/50 hover:bg-accent/[0.04]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
            )}
          >
            <span className="flex w-full items-center gap-2">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg border border-border-base bg-surface-2/60 text-accent">
                <Icon size={14} aria-hidden />
              </span>
              <span className="truncate text-[14px] font-medium tracking-snug text-fg">
                {option.label}
              </span>
            </span>
            <span className="text-[12.5px] leading-snug text-fg-subtle">{option.description}</span>
            <span className="mt-auto inline-flex items-center gap-1 pt-1 text-[12px] font-medium text-fg-subtle transition-colors group-hover:text-accent">
              {t('gallery.open')}
              <ArrowRight
                size={13}
                aria-hidden
                className="transition-transform duration-fast group-hover:translate-x-0.5"
              />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
};
