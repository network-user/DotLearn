import type { ReactNode } from 'react';

import { Tooltip } from '@/components/ui/Tooltip';
import { cx } from '@/components/ui/cx';
import { getCurrentLanguage } from '@/lib/i18n';
import { getGlossaryEntry } from '@/lib/glossary';

interface TermProps {
  id: string;
  children?: ReactNode;
}

export const Term = ({ id, children }: TermProps) => {
  const entry = getGlossaryEntry(id);

  if (!entry) {
    return <span>{children}</span>;
  }

  const lang = getCurrentLanguage();
  const label = children ?? entry.term[lang];

  return (
    <Tooltip
      side="top"
      content={
        <span className="block max-w-[260px] text-[12.5px] leading-snug">{entry.def[lang]}</span>
      }
    >
      <button
        type="button"
        aria-label={entry.term[lang]}
        className={cx(
          'cursor-help border-b border-dotted border-accent/50 text-fg decoration-accent/50',
          'bg-transparent p-0 font-[inherit] text-inherit align-baseline',
          'focus:outline-none focus-visible:ring-1 focus-visible:ring-accent/60 rounded-sm',
        )}
      >
        {label}
      </button>
    </Tooltip>
  );
};
