import { useState } from 'react';

import type { OnecCommand, OnecSeed } from '@dotlearn/contracts';
import { Link } from '@tanstack/react-router';
import { Warehouse } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { OnecStand } from '@/components/onec/OnecStand';
import { Button } from '@/components/ui/Button';
import { Seo } from '@/lib/seo';

const SEED: OnecSeed = {
  today: '2026-03-20',
  counterparties: [],
  products: [{ name: 'Бумага А4' }],
  warehouses: [{ name: 'Основной' }],
};

export const WorkbenchPage = () => {
  const { t } = useTranslation('workbench');
  const { t: tSeo } = useTranslation('seo');
  const [commands, setCommands] = useState<OnecCommand[]>([]);

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
      <OnecStand seed={SEED} commands={commands} onChange={setCommands} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          className="h-11 sm:h-9"
          onClick={() => setCommands([])}
        >
          {t('reset')}
        </Button>
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
