import { useState } from 'react';

import { Lightbulb } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cx } from '@/components/ui/cx';

interface HintBlockProps {
  hints: string[] | undefined;
}

export const HintBlock = ({ hints }: HintBlockProps) => {
  const { t } = useTranslation('runners');
  const [open, setOpen] = useState(false);
  if (!hints || hints.length === 0) return null;
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-[12px] text-fg-muted hover:text-fg transition-colors"
        aria-expanded={open}
      >
        <Lightbulb size={12} className="text-warn" />
        {open ? t('common.hideHints') : t('common.showHints', { count: hints.length })}
      </button>
      <ul
        className={cx(
          'grid transition-[grid-template-rows] duration-med ease-standard',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <li className="overflow-hidden">
          <ol className="rounded-lg border border-warn/20 bg-warn/8 px-4 py-3 list-decimal pl-6 marker:text-warn/70 text-[13px] text-fg space-y-1">
            {hints.map((hint, index) => (
              <li key={index}>{hint}</li>
            ))}
          </ol>
        </li>
      </ul>
    </div>
  );
};
