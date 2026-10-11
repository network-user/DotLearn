import { useEffect, useState } from 'react';

import type { OnecCommand, OnecSeed } from '@dotlearn/contracts';
import { useTranslation } from 'react-i18next';

import { OnecStand } from '@/components/onec/OnecStand';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { loadStandCommands, saveStandCommands } from '@/lib/playground';

const SEED: OnecSeed = {
  today: '2026-03-20',
  counterparties: [],
  products: [{ name: 'Бумага А4' }],
  warehouses: [{ name: 'Основной' }],
};

export const StandPlayground = () => {
  const { t } = useTranslation('sandbox');
  const [commands, setCommands] = useState<OnecCommand[] | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    loadStandCommands()
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

  const update = (next: OnecCommand[]): void => {
    setCommands(next);
    void saveStandCommands(next);
  };

  if (commands === undefined) {
    return <Skeleton rounded="xl" className="h-96" />;
  }

  return (
    <div className="space-y-4">
      <p className="max-w-prose text-sm text-fg-muted">{t('stand.note')}</p>
      <OnecStand seed={SEED} commands={commands} onChange={update} />
      <Button type="button" variant="outline" className="h-11 sm:h-9" onClick={() => update([])}>
        {t('stand.reset')}
      </Button>
    </div>
  );
};
