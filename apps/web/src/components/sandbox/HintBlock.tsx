import { useState } from 'react';

import { ChevronRight, Lightbulb } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface HintBlockProps {
  hints: string[] | undefined;
  onAllHintsShown?: () => void;
}

export const HintBlock = ({ hints, onAllHintsShown }: HintBlockProps) => {
  const { t } = useTranslation('runners');
  const [shown, setShown] = useState(0);
  if (!hints || hints.length === 0) return null;
  const total = hints.length;
  const allShown = shown >= total;
  const reveal = (next: number): void => {
    setShown(next);
    if (next >= total) {
      onAllHintsShown?.();
    }
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {shown === 0 ? (
          <button
            type="button"
            onClick={() => reveal(1)}
            className="inline-flex items-center gap-1.5 text-[12px] text-fg-muted hover:text-fg transition-colors"
          >
            <Lightbulb size={12} className="text-warn" />
            {t('common.revealHint', { total })}
          </button>
        ) : (
          <>
            {!allShown && (
              <button
                type="button"
                onClick={() => reveal(Math.min(total, shown + 1))}
                className="inline-flex items-center gap-1.5 text-[12px] font-medium text-warn hover:text-warn/80 transition-colors"
              >
                <ChevronRight size={12} />
                {t('common.nextHint', { shown, total })}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShown(0)}
              className="inline-flex items-center gap-1.5 text-[12px] text-fg-subtle hover:text-fg transition-colors"
            >
              {t('common.hideHints')}
            </button>
          </>
        )}
      </div>
      {shown > 0 && (
        <ol className="rounded-lg border border-warn/20 bg-warn/8 px-4 py-3 list-decimal pl-6 marker:text-warn/70 text-[13px] text-fg space-y-1">
          {hints.slice(0, shown).map((hint, index) => (
            <li key={index}>{hint}</li>
          ))}
        </ol>
      )}
    </div>
  );
};
