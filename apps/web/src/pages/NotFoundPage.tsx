import { Link } from '@tanstack/react-router';
import { Compass } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { Seo } from '@/lib/seo';

export const NotFoundPage = () => {
  const { t } = useTranslation('notFound');
  const { t: tNav } = useTranslation('nav');

  return (
    <div className="space-y-8">
      <Seo robots="noindex,nofollow" title={t('title')} />
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 eyebrow text-fg-subtle">
          <Compass size={12} className="text-accent" />
          <span>404</span>
        </div>
        <h1 className="font-display text-3xl tracking-tightish text-fg">{t('title')}</h1>
        <p className="max-w-prose text-sm text-fg-muted">{t('text')}</p>
      </header>
      <div className="flex flex-wrap items-center gap-4">
        <Link to="/" hash="topics">
          <Button variant="primary" size="md">
            {t('cta')}
          </Button>
        </Link>
        <Link to="/" className="text-sm font-medium text-accent hover:underline underline-offset-2">
          {tNav('home')}
        </Link>
      </div>
    </div>
  );
};
