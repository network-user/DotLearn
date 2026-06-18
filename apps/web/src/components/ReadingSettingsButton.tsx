import { useEffect, useRef, useState } from 'react';

import { Link } from '@tanstack/react-router';
import { Type } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { cx } from '@/components/ui/cx';
import {
  READING_SIZES,
  setSettings,
  useSettings,
  type ReadingFont,
  type ReadingSize,
  type ReadingSpacing,
} from '@/lib/settings';
import { resolveTheme, type Theme } from '@/lib/theme';

interface RowOption<T extends string> {
  value: T;
  label: string;
}

function ControlRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: RowOption<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12px] text-fg-muted">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className="inline-flex rounded-lg border border-border-base bg-surface-2/50 p-0.5"
      >
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option.value)}
              className={cx(
                'min-h-[32px] px-2.5 rounded-md text-[12px] font-medium transition-colors',
                active ? 'bg-accent text-surface dark:text-canvas' : 'text-fg-muted hover:text-fg',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export const ReadingSettingsButton = () => {
  const { t } = useTranslation('topic');
  const settings = useSettings();
  const [open, setOpen] = useState(false);
  const theme: Theme = resolveTheme(settings.themePreference);
  const ref = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent): void => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    const trigger = triggerRef.current;
    const focusTimer = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
    }, 0);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(focusTimer);
      trigger?.focus();
    };
  }, [open]);

  const changeTheme = (next: Theme): void => {
    setSettings({ themePreference: next });
  };

  const sizeLabel: Record<ReadingSize, string> = {
    compact: t('reading.sizeCompact'),
    normal: t('reading.sizeNormal'),
    comfortable: t('reading.sizeComfortable'),
  };

  return (
    <div ref={ref} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t('reading.button')}
        title={t('reading.button')}
        onClick={() => setOpen((value) => !value)}
        className={cx(
          'grid place-items-center size-9 rounded-lg border transition-colors',
          open
            ? 'border-accent/50 bg-accent/[0.08] text-accent'
            : 'border-border-base text-fg-muted hover:text-fg hover:bg-surface-2/50',
        )}
      >
        <Type size={16} aria-hidden />
      </button>
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={t('reading.title')}
          className="absolute right-0 top-full z-[var(--z-sheet)] mt-2 w-64 space-y-3 rounded-xl border border-border-base glass-strong p-3 shadow-float"
        >
          <div className="eyebrow text-fg-subtle">{t('reading.title')}</div>
          <ControlRow
            label={t('reading.theme')}
            value={theme}
            onChange={changeTheme}
            options={[
              { value: 'light', label: t('reading.themeLight') },
              { value: 'dark', label: t('reading.themeDark') },
            ]}
          />
          <ControlRow
            label={t('reading.size')}
            value={settings.reading}
            onChange={(value: ReadingSize) => setSettings({ reading: value })}
            options={READING_SIZES.map((size) => ({ value: size, label: sizeLabel[size] }))}
          />
          <ControlRow
            label={t('reading.font')}
            value={settings.readingFont}
            onChange={(value: ReadingFont) => setSettings({ readingFont: value })}
            options={[
              { value: 'serif', label: t('reading.fontSerif') },
              { value: 'sans', label: t('reading.fontSans') },
            ]}
          />
          <ControlRow
            label={t('reading.spacing')}
            value={settings.readingSpacing}
            onChange={(value: ReadingSpacing) => setSettings({ readingSpacing: value })}
            options={[
              { value: 'normal', label: t('reading.spacingNormal') },
              { value: 'relaxed', label: t('reading.spacingRelaxed') },
            ]}
          />
          <Link
            to="/settings"
            onClick={() => setOpen(false)}
            className="block pt-1 text-[12px] text-accent hover:underline"
          >
            {t('reading.allSettings')}
          </Link>
        </div>
      )}
    </div>
  );
};
