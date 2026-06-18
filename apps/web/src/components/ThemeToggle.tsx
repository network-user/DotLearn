import { useTranslation } from 'react-i18next';

import { setSettings, useSettings } from '@/lib/settings';
import { resolveTheme } from '@/lib/theme';

export const ThemeToggle = () => {
  const { t } = useTranslation('theme');
  const settings = useSettings();
  const isDark = resolveTheme(settings.themePreference) === 'dark';

  const toggle = (): void => {
    setSettings({ themePreference: isDark ? 'light' : 'dark' });
  };

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
