import { createContext, useContext } from 'react';

export const ForcedContentLanguageContext = createContext<'ru' | 'en' | null>(null);

export const useForcedContentLanguage = (): 'ru' | 'en' | null =>
  useContext(ForcedContentLanguageContext);
