import { useEffect } from 'react';

import { Outlet } from '@tanstack/react-router';
import { I18nextProvider } from 'react-i18next';

import { ForcedContentLanguageContext } from '@/lib/forced-language';
import i18n, { getCurrentLanguage } from '@/lib/i18n';

const enI18n = i18n.cloneInstance({ lng: 'en' });

export const EnLayout = () => {
  useEffect(() => {
    document.documentElement.lang = 'en';
    return () => {
      document.documentElement.lang = getCurrentLanguage();
    };
  }, []);

  return (
    <ForcedContentLanguageContext.Provider value="en">
      <I18nextProvider i18n={enI18n}>
        <Outlet />
      </I18nextProvider>
    </ForcedContentLanguageContext.Provider>
  );
};
