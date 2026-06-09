import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import en from '../locales/en.json';
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
      en: en as Record<string, Record<string, unknown>>,
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
  await i18n.changeLanguage(lang);
};

export default i18n;
