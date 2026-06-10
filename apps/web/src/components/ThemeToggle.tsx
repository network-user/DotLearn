import { useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';

import { applyTheme, persistTheme, readStoredTheme, type Theme } from '@/lib/theme';

export const ThemeToggle = () => {
  const { t } = useTranslation('theme');
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const initial = readStoredTheme();
    setTheme(initial);
    applyTheme(initial);
  }, []);

  const toggle = (): void => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    applyTheme(next);
    persistTheme(next);
  };

  const isDark = theme === 'dark';
  const label = isDark ? t('switchToLight') : t('switchToDark');
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="inline-flex items-center justify-center min-h-[var(--tap)] min-w-[var(--tap)] sm:min-h-0 sm:min-w-0 rounded-md border border-border-base px-2 py-1.5 text-sm text-fg-muted hover:text-fg hover:bg-surface-2 transition"
    >
      <span aria-hidden className="font-mono text-[11px] uppercase tracking-wide">
        {isDark ? t('dark') : t('light')}
      </span>
    </button>
  );
};
