import { useEffect, useMemo, useRef, useState } from 'react';

import type { OnecCommand, OnecSeed } from '@dotlearn/contracts';
import { gradeOnecSession } from '@dotlearn/lesson-engine';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { GUIDE_GOAL, GUIDE_STEPS } from '@/components/onec/guide-script';
import { OnecCoach } from '@/components/onec/OnecCoach';
import { OnecStand } from '@/components/onec/OnecStand';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { loadStandCommands, saveStandCommands } from '@/lib/playground';

const SEED: OnecSeed = {
  today: '2026-03-20',
  counterparties: [],
  products: [{ name: 'Бумага А4' }],
  warehouses: [{ name: 'Основной' }],
  receipts: [],
  sales: [],
};

export const StandPlayground = () => {
  const { t } = useTranslation('sandbox');
  const standRef = useRef<HTMLDivElement>(null);
  const [commands, setCommands] = useState<OnecCommand[] | undefined>(undefined);
  const [tour, setTour] = useState<OnecCommand[] | null>(null);

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

  const tourGrade = useMemo(
    () =>
      tour
        ? gradeOnecSession(
            { mode: 'steps', seed: SEED, steps: GUIDE_STEPS, goal: GUIDE_GOAL },
            tour,
          )
        : null,
    [tour],
  );
  const tourIndex = tourGrade?.steps.findIndex((step) => !step.ok) ?? -1;
  const tourDone = tourGrade !== null && tourIndex === -1;
  const tourStep = !tourDone && tourIndex >= 0 ? GUIDE_STEPS[tourIndex] : null;

  if (commands === undefined) {
    return <Skeleton rounded="xl" className="h-96" />;
  }

  return (
    <div className="space-y-4">
      <p className="max-w-prose text-sm text-fg-muted">{t('stand.note')}</p>
      <Link
        to="/onec"
        className="inline-flex min-h-[var(--tap)] items-center text-sm font-medium text-accent underline-offset-2 hover:underline"
      >
        {t('stand.openOnec')}
      </Link>
      <div ref={standRef} className="relative">
        <OnecStand
          seed={SEED}
          commands={tour ?? commands}
          onChange={tour ? setTour : update}
          focus={tourStep?.focus}
        />
        {tour && (tourStep || tourDone) ? (
          <OnecCoach
            rootRef={standRef}
            title={tourDone ? t('stand.tourDoneTitle') : (tourStep?.title ?? '')}
            body={tourDone ? t('stand.tourDoneBody') : (tourStep?.coach ?? '')}
            index={tourDone ? GUIDE_STEPS.length - 1 : tourIndex}
            total={GUIDE_STEPS.length}
            revision={`${(tour ?? []).length}:${tourStep?.id ?? 'done'}`}
            onClose={() => setTour(null)}
            closeLabel={tourDone ? t('stand.tourClose') : t('stand.tourExit')}
          />
        ) : null}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          className="h-11 sm:h-9"
          onClick={() => setTour(tour ? null : [])}
        >
          {tour ? t('stand.tourExit') : t('stand.tour')}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 sm:h-9"
          onClick={() => update([])}
          disabled={tour !== null}
        >
          {t('stand.reset')}
        </Button>
      </div>
    </div>
  );
};
