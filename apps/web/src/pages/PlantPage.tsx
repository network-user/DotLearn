import { useEffect, useState } from 'react';

import type { DesignerCommand, DesignerSeed } from '@dotlearn/contracts';
import { Link } from '@tanstack/react-router';
import { Factory } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { DesignerStand } from '@/components/onec/DesignerStand';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { loadPlantCommands, savePlantCommands } from '@/lib/plant-store';
import { Seo } from '@/lib/seo';

const SEED: DesignerSeed = {
  today: '2024-06-03',
  catalogs: [],
  documents: [],
  registers: [],
  items: [],
  docs: [],
};

export const PlantPage = () => {
  const { t } = useTranslation('plant');
  const { t: tSeo } = useTranslation('seo');
  const [commands, setCommands] = useState<DesignerCommand[] | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    loadPlantCommands()
      .then((loaded) => {
        if (!cancelled) setCommands(loaded);
      })
      .catch(() => {
        if (!cancelled) setCommands([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (next: DesignerCommand[]): void => {
    setCommands(next);
    void savePlantCommands(next);
  };

  return (
    <div className="space-y-4">
      <Seo
        title={t('title')}
        description={tSeo('plantDescription')}
        canonicalPath="/plant"
        robots="noindex,nofollow"
      />
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 eyebrow text-fg-subtle">
          <Factory size={12} className="text-accent" />
          <span>{t('eyebrow')}</span>
        </div>
        <h1 className="font-display text-3xl tracking-tightish text-fg">{t('title')}</h1>
        <p className="max-w-prose text-sm text-fg-muted">{t('subtitle')}</p>
      </header>
      {commands === undefined ? (
        <Skeleton rounded="xl" className="h-96" />
      ) : (
        <DesignerStand seed={SEED} commands={commands} onChange={update} />
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="ghost"
          className="h-11 w-full sm:h-9 sm:w-auto"
          onClick={() => update([])}
          disabled={commands === undefined || commands.length === 0}
        >
          {t('reset')}
        </Button>
        <Link
          to="/topics/$slug"
          params={{ slug: 'plant-case' }}
          className="inline-flex h-11 items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-surface sm:h-9"
        >
          {t('openLesson')}
        </Link>
      </div>
    </div>
  );
};
