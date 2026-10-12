import { useTranslation } from 'react-i18next';

import { ClinicApp } from '@/components/clinic/ClinicApp';
import { Seo } from '@/lib/seo';

export const ClinicPage = () => {
  const { t } = useTranslation('clinic');
  const { t: tSeo } = useTranslation('seo');

  return (
    <div className="space-y-4">
      <Seo
        title={t('title')}
        description={tSeo('clinicDescription')}
        canonicalPath="/clinic"
        robots="noindex,nofollow"
      />
      <header className="space-y-2">
        <p className="eyebrow text-fg-subtle">{t('eyebrow')}</p>
        <h1 className="font-display text-3xl tracking-tightish text-fg">{t('title')}</h1>
        <p className="max-w-prose text-sm text-fg-muted">{t('subtitle')}</p>
      </header>
      <ClinicApp />
    </div>
  );
};
