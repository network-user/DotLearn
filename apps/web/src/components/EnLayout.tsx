import { useEffect, useState } from 'react';

import { Outlet } from '@tanstack/react-router';
import { I18nextProvider } from 'react-i18next';

import { ForcedContentLanguageContext } from '@/lib/forced-language';
import i18n, { ensureLanguageResources, getCurrentLanguage } from '@/lib/i18n';

const enI18n = i18n.cloneInstance({ lng: 'en' });

export const EnLayout = () => {
  const [resourcesReady, setResourcesReady] = useState(() =>
    i18n.hasResourceBundle('en', 'common'),
  );

  useEffect(() => {
    document.documentElement.lang = 'en';
    return () => {
      document.documentElement.lang = getCurrentLanguage();
    };
  }, []);

  useEffect(() => {
    if (resourcesReady) return;
    let active = true;
    void ensureLanguageResources('en').then(() => {
      if (active) setResourcesReady(true);
    });
    return () => {
      active = false;
    };
  }, [resourcesReady]);

  if (!resourcesReady) {
    return null;
  }

  return (
    <ForcedContentLanguageContext.Provider value="en">
      <I18nextProvider i18n={enI18n}>
        <Outlet />
      </I18nextProvider>
    </ForcedContentLanguageContext.Provider>
  );
};
