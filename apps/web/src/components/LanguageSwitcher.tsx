import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { SUPPORTED_LANGUAGES, getCurrentLanguage } from '@/lib/i18n';
import { applyLanguageSelection, routeLanguageFromPathname } from '@/lib/localized-routes';
import { topicHasEn } from '@/lib/topics';

interface LanguageSwitcherProps {
  variant?: 'compact' | 'full';
}

type Lang = (typeof SUPPORTED_LANGUAGES)[number];

const TOPIC_PATH_PATTERN = /^\/(?:en\/)?topics\/([^/]+)$/;

export const LanguageSwitcher = ({ variant = 'compact' }: LanguageSwitcherProps) => {
  const { t, i18n } = useTranslation('common');
  const current = getCurrentLanguage();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const search = useRouterState({ select: (state) => state.location.search });

  const topicMatch = TOPIC_PATH_PATTERN.exec(pathname);
  const topicSlug = topicMatch?.[1];
  const routeLanguage = routeLanguageFromPathname(pathname);

  const disabledLang: Lang | undefined = topicSlug && !topicHasEn(topicSlug) ? 'en' : undefined;

  const handleChange = (lang: Lang): void => {
    if (lang === disabledLang) return;
    void applyLanguageSelection(lang, { pathname, search, navigate });
  };

  const isActive = (lang: Lang): boolean =>
    routeLanguage ? lang === routeLanguage : lang === i18n.resolvedLanguage || lang === current;

  if (variant === 'compact') {
    return (
      <div
        className="inline-flex items-center rounded-md border border-border-base bg-surface p-0.5 text-xs font-medium"
        role="group"
        aria-label={t('languageLabel')}
      >
        {SUPPORTED_LANGUAGES.map((lang) => {
          const active = isActive(lang);
          const disabled = lang === disabledLang;
          return (
            <button
              key={lang}
              type="button"
              onClick={() => handleChange(lang)}
              aria-pressed={active}
              disabled={disabled}
              title={disabled ? t('noEnglishHint') : undefined}
              className={
                'inline-flex items-center justify-center min-h-[var(--tap)] min-w-[var(--tap)] sm:min-h-0 sm:min-w-0 px-2 py-1 rounded-sm uppercase tracking-wide transition ' +
                (disabled
                  ? 'cursor-not-allowed text-fg-subtle opacity-50'
                  : active
                    ? 'bg-accent text-surface dark:text-canvas'
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
          const active = isActive(lang);
          const disabled = lang === disabledLang;
          return (
            <label
              key={lang}
              title={disabled ? t('noEnglishHint') : undefined}
              className={
                'flex items-center gap-3 rounded-lg border px-4 py-3 transition ' +
                (disabled
                  ? 'cursor-not-allowed border-border-base bg-surface opacity-50'
                  : 'cursor-pointer ' +
                    (active
                      ? 'border-accent/60 bg-accent/10'
                      : 'border-border-base bg-surface hover:border-border-strong'))
              }
            >
              <input
                type="radio"
                name="dotlearn-language"
                value={lang}
                checked={active}
                disabled={disabled}
                onChange={() => handleChange(lang)}
                className="accent-[rgb(var(--accent-1))]"
              />
              <span className="text-sm font-medium text-fg">{t(lang)}</span>
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
