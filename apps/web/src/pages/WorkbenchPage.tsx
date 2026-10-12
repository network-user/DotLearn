import { Link } from '@tanstack/react-router';
import { Warehouse } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { StandPlayground } from '@/components/playground/StandPlayground';
import { Seo } from '@/lib/seo';

export const WorkbenchPage = () => {
  const { t } = useTranslation('workbench');
  const { t: tSeo } = useTranslation('seo');

  return (
    <div className="space-y-6">
      <Seo
        title={t('title')}
        description={tSeo('workbenchDescription')}
        canonicalPath="/workbench"
        robots="noindex,nofollow"
      />
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 eyebrow text-fg-subtle">
          <Warehouse size={12} className="text-accent" />
          <span>{t('eyebrow')}</span>
        </div>
        <h1 className="font-display text-3xl tracking-tightish text-fg">{t('title')}</h1>
        <p className="max-w-prose text-sm text-fg-muted">{t('subtitle')}</p>
      </header>
      <StandPlayground />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link
          to="/clinic"
          className="inline-flex h-11 items-center justify-center rounded-md border border-border-strong bg-surface px-4 text-sm font-medium text-fg sm:h-9"
        >
          {t('openClinic')}
        </Link>
        <Link
          to="/topics/$slug"
          params={{ slug: 'onec-workbench' }}
          className="inline-flex h-11 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-surface sm:h-9"
        >
          {t('openLesson')}
        </Link>
      </div>
    </div>
  );
};
