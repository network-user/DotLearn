import { useCallback, useEffect, useState } from 'react';

import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { Dialog } from '@/components/ui/Dialog';
import {
  CATALOG_CATEGORY_ORDER,
  categoryLabelKey,
  type CatalogCategoryId,
} from '@/lib/catalog-categories';
import {
  EXPERIENCE_LEVELS,
  categoriesOfSlugs,
  getPersonalization,
  setPersonalization,
  type ExperienceLevel,
} from '@/lib/personalization';
import { PERSONALIZE_WIZARD_EVENT } from '@/lib/personalize-wizard';
import { getTrack, tracks, trackMemberSlugs } from '@/lib/tracks';

const STEP_COUNT = 3;
const SEEN_KEY = 'dotlearn:personalize-seen';
const ONBOARDING_SEEN_KEY = 'dotlearn:onboarding-seen';

const readSeen = (): boolean => {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
};

const writeSeen = (): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* ignore */
  }
};

const readOnboardingSeen = (): boolean => {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(ONBOARDING_SEEN_KEY) === '1';
  } catch {
    return false;
  }
};

const STEP_TITLE_KEY = [
  'personalize.level.title',
  'personalize.track.title',
  'personalize.categories.title',
];

const OptionCard = ({
  active,
  title,
  eyebrow,
  hint,
  onClick,
}: {
  active: boolean;
  title: string;
  eyebrow?: string;
  hint: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={cx(
      'text-left rounded-xl border p-4 min-h-[var(--tap)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/55',
      active
        ? 'border-accent/70 bg-accent/[0.08]'
        : 'border-border-base hover:border-border-strong hover:bg-fg/[0.03]',
    )}
  >
    <div className="flex items-center justify-between gap-2">
      <span className="font-medium text-fg">{title}</span>
      {active && <Check size={16} className="shrink-0 text-accent" />}
    </div>
    {eyebrow && (
      <p className="mt-0.5 text-[11px] uppercase tracking-widest text-accent">{eyebrow}</p>
    )}
    <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">{hint}</p>
  </button>
);

export const PersonalizeWizard = () => {
  const { t } = useTranslation(['personalize', 'home']);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [levelDraft, setLevelDraft] = useState<ExperienceLevel | undefined>(undefined);
  const [trackIdsDraft, setTrackIdsDraft] = useState<string[]>([]);
  const [interestsDraft, setInterestsDraft] = useState<CatalogCategoryId[]>([]);

  const openWizard = useCallback((): void => {
    const profile = getPersonalization();
    setLevelDraft(profile.level);
    setTrackIdsDraft(profile.trackIds);
    setInterestsDraft(profile.interests);
    setStep(0);
    setOpen(true);
  }, []);

  useEffect(() => {
    window.addEventListener(PERSONALIZE_WIZARD_EVENT, openWizard);
    return () => window.removeEventListener(PERSONALIZE_WIZARD_EVENT, openWizard);
  }, [openWizard]);

  useEffect(() => {
    if (!readSeen() && readOnboardingSeen()) {
      openWizard();
    }
    // Auto-open once per browser; brand-new users get chained via Onboarding's onDismiss instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const closeWithoutSaving = (): void => {
    writeSeen();
    setOpen(false);
  };

  const handleOpenChange = (next: boolean): void => {
    if (!next) closeWithoutSaving();
  };

  const finish = (): void => {
    setPersonalization({
      ...(levelDraft !== undefined ? { level: levelDraft } : {}),
      trackIds: trackIdsDraft,
      interests: interestsDraft,
      configuredAt: new Date().toISOString(),
    });
    writeSeen();
    setOpen(false);
  };

  const toggleTrack = (id: string): void => {
    const next = trackIdsDraft.includes(id)
      ? trackIdsDraft.filter((entry) => entry !== id)
      : [...trackIdsDraft, id];
    setTrackIdsDraft(next);
    const derived = categoriesOfSlugs(
      next.flatMap((trackId) => {
        const track = getTrack(trackId);
        return track ? trackMemberSlugs(track) : [];
      }),
    );
    setInterestsDraft((prev) => [...new Set([...prev, ...derived])]);
  };

  const toggleCategory = (id: CatalogCategoryId): void => {
    setInterestsDraft((prev) =>
      prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id],
    );
  };

  const isLast = step === STEP_COUNT - 1;
  const nextDisabled = step === 0 && levelDraft === undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      placement="sheet"
      size="lg"
      title={t(STEP_TITLE_KEY[step] as string)}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="md"
            onClick={closeWithoutSaving}
            className="min-h-[var(--tap)] sm:min-h-0"
          >
            {t('personalize:skip')}
          </Button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button
                variant="outline"
                size="md"
                onClick={() => setStep((value) => Math.max(0, value - 1))}
                className="min-h-[var(--tap)] sm:min-h-0"
              >
                {t('personalize:back')}
              </Button>
            )}
            <Button
              variant="primary"
              size="md"
              disabled={nextDisabled}
              onClick={() => {
                if (isLast) {
                  finish();
                } else {
                  setStep((value) => Math.min(STEP_COUNT - 1, value + 1));
                }
              }}
              className="min-h-[var(--tap)] sm:min-h-0"
            >
              {isLast ? t('personalize:done') : t('personalize:next')}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {step === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-fg-muted">{t('personalize:level.body')}</p>
            <div className="grid gap-2">
              {EXPERIENCE_LEVELS.map((level) => (
                <OptionCard
                  key={level}
                  active={levelDraft === level}
                  title={t(`personalize:level.options.${level}.title`)}
                  hint={t(`personalize:level.options.${level}.hint`)}
                  onClick={() => setLevelDraft(level)}
                />
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-fg-muted">{t('personalize:track.body')}</p>
            <div className="grid gap-2">
              {tracks.map((track) => (
                <OptionCard
                  key={track.id}
                  active={trackIdsDraft.includes(track.id)}
                  title={track.title}
                  hint={track.description}
                  onClick={() => toggleTrack(track.id)}
                  {...(track.targetRole ? { eyebrow: track.targetRole } : {})}
                />
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-fg-muted">{t('personalize:categories.body')}</p>
            <div className="flex flex-wrap gap-1.5">
              {CATALOG_CATEGORY_ORDER.filter((id) => id !== 'other').map((id) => {
                const active = interestsDraft.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleCategory(id)}
                    aria-pressed={active}
                    className={cx(
                      'inline-flex items-center gap-1.5 rounded-full border px-3 min-h-[var(--tap)] sm:min-h-0 sm:py-1.5 text-[12px] tracking-snug transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/55',
                      active
                        ? 'border-accent/70 bg-accent/[0.16] text-accent font-medium'
                        : 'border-border-base text-fg-muted hover:text-fg hover:bg-fg/[0.04]',
                    )}
                  >
                    {t(`home:${categoryLabelKey(id)}`)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center gap-1.5" aria-hidden>
          {Array.from({ length: STEP_COUNT }, (_, index) => (
            <span
              key={index}
              className={cx(
                'h-1.5 rounded-full transition-all duration-fast',
                index === step ? 'w-6 bg-accent' : 'w-1.5 bg-border-strong',
              )}
            />
          ))}
        </div>
      </div>
    </Dialog>
  );
};
