import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import ru from '../locales/ru.json';

export const SUPPORTED_LANGUAGES = ['ru', 'en'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'ru';

const STORAGE_KEY = 'dotlearn:language';

const isSupported = (value: string | null | undefined): value is SupportedLanguage =>
  value === 'ru' || value === 'en';

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ru: ru as Record<string, Record<string, unknown>>,
    },
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    interpolation: { escapeValue: false },
    returnNull: false,
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: STORAGE_KEY,
      caches: ['localStorage'],
    },
  });

let englishResources: Promise<void> | null = null;

const loadEnglish = (): Promise<void> => {
  if (!englishResources) {
    englishResources = import('../locales/en.json').then((module) => {
      const bundles = module.default as Record<string, Record<string, unknown>>;
      for (const [namespace, resources] of Object.entries(bundles)) {
        i18n.addResourceBundle('en', namespace, resources, true, true);
      }
    });
  }
  return englishResources;
};

export const ensureLanguageResources = (lang: SupportedLanguage): Promise<void> =>
  lang === 'en' ? loadEnglish() : Promise.resolve();

const syncHtmlLang = (lang: string): void => {
  const normalized = isSupported(lang) ? lang : DEFAULT_LANGUAGE;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = normalized;
  }
};

syncHtmlLang(i18n.language);
i18n.on('languageChanged', syncHtmlLang);

export const getCurrentLanguage = (): SupportedLanguage =>
  isSupported(i18n.language) ? i18n.language : DEFAULT_LANGUAGE;

export const setLanguage = async (lang: SupportedLanguage): Promise<void> => {
  await ensureLanguageResources(lang);
  await i18n.changeLanguage(lang);
};

const isForcedEnglishRoute = (): boolean =>
  typeof window !== 'undefined' && /^\/en(?:\/|$)/.test(window.location.pathname);

if (getCurrentLanguage() === 'en' || isForcedEnglishRoute()) {
  await ensureLanguageResources('en');
}

export default i18n;
