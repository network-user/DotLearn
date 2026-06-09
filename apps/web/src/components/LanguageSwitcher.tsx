import { useTranslation } from 'react-i18next';

import { SUPPORTED_LANGUAGES, getCurrentLanguage, setLanguage } from '@/lib/i18n';

interface LanguageSwitcherProps {
  variant?: 'compact' | 'full';
}

export const LanguageSwitcher = ({ variant = 'compact' }: LanguageSwitcherProps) => {
  const { t, i18n } = useTranslation('common');
  const current = getCurrentLanguage();

  const handleChange = (lang: (typeof SUPPORTED_LANGUAGES)[number]) => {
    if (lang === current) return;
    void setLanguage(lang);
  };

  if (variant === 'compact') {
    return (
      <div
        className="inline-flex items-center rounded-md border border-border-base bg-surface/40 p-0.5 text-xs font-medium"
        role="group"
        aria-label={t('languageLabel')}
      >
        {SUPPORTED_LANGUAGES.map((lang) => {
          const active = lang === i18n.resolvedLanguage || lang === current;
          return (
            <button
              key={lang}
              type="button"
              onClick={() => handleChange(lang)}
              aria-pressed={active}
              className={
                'px-2 py-1 rounded-sm uppercase tracking-wide transition ' +
                (active
                  ? 'bg-indigo-500 text-white'
                  : 'text-fg-muted hover:text-fg hover:bg-surface-2')
              }
            >
              {lang}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label={t('languageLabel')} className="flex flex-col gap-2">
        {SUPPORTED_LANGUAGES.map((lang) => {
          const active = lang === i18n.resolvedLanguage || lang === current;
          return (
            <label
              key={lang}
              className={
                'flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition ' +
                (active
                  ? 'border-indigo-500/60 bg-indigo-500/10'
                  : 'border-border-base bg-surface/40 hover:border-border-strong')
              }
            >
              <input
                type="radio"
                name="dotlearn-language"
                value={lang}
                checked={active}
                onChange={() => handleChange(lang)}
                className="accent-indigo-500"
              />
              <span className="text-sm font-medium text-fg">
                {t(lang)}
              </span>
              <span className="ml-auto text-[10px] uppercase tracking-wide text-fg-subtle">
                {lang}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
};
