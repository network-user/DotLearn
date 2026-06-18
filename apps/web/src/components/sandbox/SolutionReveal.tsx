import { useState } from 'react';

import { Eye, Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cx } from '@/components/ui/cx';

interface SolutionRevealProps {
  solution: string;
  language: string;
  unlocked: boolean;
  onReveal?: () => void;
}

export const SolutionReveal = ({ solution, language, unlocked, onReveal }: SolutionRevealProps) => {
  const { t } = useTranslation('runners');
  const [confirming, setConfirming] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const handleReveal = (): void => {
    setRevealed(true);
    setConfirming(false);
    onReveal?.();
  };

  if (revealed) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <Eye size={12} className="text-fg-subtle" aria-hidden />
          <span className="eyebrow font-mono">{t('common.solutionLabel')}</span>
        </div>
        <pre
          className="rounded-lg border border-border-base bg-code-bg p-3 text-[12.5px] font-mono text-fg overflow-x-auto leading-relaxed whitespace-pre-wrap break-words"
          data-language={language}
        >
          {solution}
        </pre>
      </div>
    );
  }

  if (!unlocked) {
    return (
      <p className="inline-flex items-center gap-1.5 text-[12px] text-fg-subtle">
        <Lock size={12} aria-hidden />
        {t('common.solutionLocked')}
      </p>
    );
  }

  if (confirming) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12.5px] text-fg-muted">{t('common.solutionConfirm')}</span>
        <button
          type="button"
          onClick={handleReveal}
          className="inline-flex h-11 items-center gap-1.5 rounded-md border border-warn/40 bg-warn/8 px-3 text-[12.5px] font-medium text-warn transition-colors hover:bg-warn/14 sm:h-8"
        >
          {t('common.solutionConfirmYes')}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="inline-flex h-11 items-center px-2 text-[12px] text-fg-subtle transition-colors hover:text-fg sm:h-8"
        >
          {t('common.solutionConfirmNo')}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className={cx(
        'inline-flex h-11 items-center gap-1.5 rounded-md px-2.5 text-[12px] text-fg-muted',
        'transition-colors hover:text-fg hover:bg-surface-2/60 sm:h-8',
      )}
    >
      <Eye size={12} className="text-fg-subtle" aria-hidden />
      {t('common.showSolution')}
    </button>
  );
};
