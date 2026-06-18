import { useCallback, useEffect, useRef, useState } from 'react';

import { Check, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cx } from '@/components/ui/cx';

interface CopyButtonProps {
  text: string;
  className?: string;
}

const COPIED_RESET_MS = 1500;

export const CopyButton = ({ text, className }: CopyButtonProps) => {
  const { t } = useTranslation('viz');
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(
    () => () => {
      if (timeoutRef.current !== undefined) {
        clearTimeout(timeoutRef.current);
      }
    },
    [],
  );

  const handleCopy = useCallback(async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      if (timeoutRef.current !== undefined) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    } catch {
      setCopied(false);
    }
  }, [text]);

  return (
    <>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={t('code.copyAriaLabel', { defaultValue: 'Скопировать код' })}
        title={t('code.copy', { defaultValue: 'Копировать' })}
        className={cx(
          'inline-flex min-h-[var(--tap)] items-center gap-1.5 rounded-md px-2 text-[11px] font-medium tracking-snug sm:min-h-0 sm:py-1',
          'transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
          copied ? 'text-ok' : 'text-fg-subtle hover:text-fg hover:bg-surface-2/60',
          className,
        )}
      >
        {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
        <span>
          {copied
            ? t('code.copied', { defaultValue: 'Скопировано' })
            : t('code.copy', { defaultValue: 'Копировать' })}
        </span>
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? t('code.copiedAnnounce', { defaultValue: 'Код скопирован' }) : ''}
      </span>
    </>
  );
};
