import { useCallback, useEffect, useState } from 'react';

import { Link } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, CalendarCheck, CheckCircle2, Flame, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cx } from '@/components/ui/cx';
import { Skeleton } from '@/components/ui/Skeleton';
import { Surface } from '@/components/ui/Surface';
import { reviewFlashcard, type FlashcardRating } from '@/lib/flashcards';
import { getCurrentLanguage } from '@/lib/i18n';
import { db } from '@/lib/progress-db';
import { loadDueAcrossDecks, loadFailedExercises, type DueCard, type FailedExercise } from '@/lib/today';
import { useStreak } from '@/lib/use-progress';

const RATINGS: { key: FlashcardRating; tone: string; hotkey: string }[] = [
  { key: 'again', tone: 'border-err/45 text-err hover:bg-err/10', hotkey: '1' },
  { key: 'hard', tone: 'border-warn/45 text-warn hover:bg-warn/10', hotkey: '2' },
  { key: 'good', tone: 'border-accent/45 text-accent hover:bg-accent/10', hotkey: '3' },
  { key: 'easy', tone: 'border-ok/45 text-ok hover:bg-ok/10', hotkey: '4' },
];

type SessionPhase = 'idle' | 'review' | 'done';

const todayUtc = (): string => new Date().toISOString().slice(0, 10);

export const TodayPage = () => {
  const { t } = useTranslation('today');
  const { t: tTypes } = useTranslation('interview');
  const language = getCurrentLanguage();

  const streak = useStreak();
  const activityToday = useLiveQuery(() => db.activity.get(todayUtc()), [], undefined);
  const solvedToday = activityToday?.exercisesPassed ?? 0;

  const [due, setDue] = useState<DueCard[] | undefined>(undefined);
  const [failed, setFailed] = useState<FailedExercise[] | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    loadDueAcrossDecks(language)
      .then((cards) => {
        if (!cancelled) setDue(cards);
      })
      .catch(() => {
        if (!cancelled) setDue([]);
      });
    loadFailedExercises(language)
      .then((items) => {
        if (!cancelled) setFailed(items);
      })
      .catch(() => {
        if (!cancelled) setFailed([]);
      });
    return () => {
      cancelled = true;
    };
  }, [language]);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 eyebrow text-fg-subtle">
          <Sparkles size={12} className="text-accent" />
          <span>{t('eyebrow')}</span>
        </div>
        <h1 className="font-display text-3xl tracking-tightish text-fg">{t('title')}</h1>
        <p className="max-w-prose text-sm text-fg-muted">{t('subtitle')}</p>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SummaryStat
          icon={<Flame size={16} className="text-accent" />}
          label={t('summary.streak')}
          value={streak}
        />
        <SummaryStat
          icon={<CheckCircle2 size={16} className="text-ok" />}
          label={t('summary.solvedToday')}
          value={solvedToday}
        />
      </div>

      <ReviewSection due={due} />

      <MistakesSection failed={failed} typeLabel={(type) => tTypes(`exam.types.${type}`, { defaultValue: type })} />
    </div>
  );
};

const SummaryStat = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) => (
  <Surface variant="chrome">
    <div className="flex items-center gap-3 p-4">
      <span className="grid size-9 place-items-center rounded-full bg-surface-2/60">{icon}</span>
      <div className="min-w-0">
        <div className="font-display text-2xl leading-none tabular-nums text-fg">{value}</div>
        <div className="mt-1 text-[11px] uppercase tracking-widest text-fg-subtle">{label}</div>
      </div>
    </div>
  </Surface>
);

const ReviewSection = ({ due }: { due: DueCard[] | undefined }) => {
  const { t } = useTranslation('today');
  const { t: tCards } = useTranslation('flashcards');
  const reduceMotion = useReducedMotion() ?? false;

  const [phase, setPhase] = useState<SessionPhase>('idle');
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);

  const queue = due ?? [];
  const total = queue.length;
  const current = phase === 'review' ? queue[pos] : undefined;
  const percent = total === 0 ? 0 : Math.round((pos / total) * 100);

  const start = useCallback(() => {
    setPhase('review');
    setPos(0);
    setFlipped(false);
    setReviewed(0);
  }, []);

  const advance = useCallback(() => {
    setFlipped(false);
    setPos((prev) => {
      const next = prev + 1;
      if (next >= total) {
        setPhase('done');
        return prev;
      }
      return next;
    });
  }, [total]);

  const rate = useCallback(
    (rating: FlashcardRating) => {
      if (!current) return;
      void reviewFlashcard(current.slug, current.card.id, rating);
      setReviewed((value) => value + 1);
      advance();
    },
    [current, advance],
  );

  useEffect(() => {
    if (phase !== 'review') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault();
        setFlipped((value) => !value);
        return;
      }
      if (!flipped) return;
      const rating = RATINGS.find((entry) => entry.hotkey === event.key);
      if (rating) {
        event.preventDefault();
        rate(rating.key);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, flipped, rate]);

  return (
    <section className="space-y-4">
      <h2 className="font-display text-2xl tracking-tightish text-fg">{t('due.heading')}</h2>

      {due === undefined && <Skeleton rounded="2xl" className="h-40" />}

      {due !== undefined && phase === 'idle' && (
        <Surface variant="inset" rule="top">
          <div className="flex flex-col items-center gap-4 p-6 text-center sm:p-8">
            {total === 0 ? (
              <p className="text-sm text-fg-muted">{t('due.empty')}</p>
            ) : (
              <>
                <div className="font-display text-4xl tabular-nums text-fg">{total}</div>
                <p className="text-sm text-fg-muted">{t('due.count', { count: total })}</p>
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full sm:w-auto"
                  leadingIcon={<CalendarCheck size={16} />}
                  onClick={start}
                >
                  {t('due.start')}
                </Button>
              </>
            )}
          </div>
        </Surface>
      )}

      {phase === 'done' && (
        <Surface variant="inset" rule="top">
          <div className="space-y-4 p-6 text-center sm:p-8">
            <h3 className="font-display text-2xl text-fg">{t('session.done')}</h3>
            <p className="text-sm text-fg-muted">{tCards('doneBody', { count: reviewed })}</p>
          </div>
        </Surface>
      )}

      {phase === 'review' && current && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-med ease-standard"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="shrink-0 text-[12px] tabular-nums text-fg-subtle">
              {tCards('progress', { current: pos + 1, total })}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setFlipped((value) => !value)}
            className="block w-full text-left"
            aria-label={tCards('flipAria')}
          >
            <Surface interactive className="min-h-[260px]">
              <div className="flex min-h-[260px] flex-col p-6 sm:p-8">
                <div className="flex items-center justify-between gap-2">
                  <span className="eyebrow text-fg-subtle">
                    {flipped ? tCards('back') : tCards('front')}
                  </span>
                  <span className="truncate text-[11px] text-fg-subtle">{current.title}</span>
                </div>
                <div className="flex flex-1 items-center justify-center py-6">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={flipped ? 'back' : 'front'}
                      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                      className={cx(
                        'text-center font-serif leading-relaxed text-fg',
                        flipped ? 'text-[17px]' : 'text-[20px] font-medium',
                      )}
                    >
                      {flipped ? current.card.back : current.card.front}
                    </motion.div>
                  </AnimatePresence>
                </div>
                <div className="text-center text-[12px] text-fg-subtle">
                  {flipped ? '' : tCards('flipHint')}
                </div>
              </div>
            </Surface>
          </button>

          {flipped ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {RATINGS.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  onClick={() => rate(entry.key)}
                  className={cx(
                    'flex h-12 items-center justify-center gap-1.5 rounded-lg border bg-surface',
                    'text-[14px] font-medium transition-colors duration-fast',
                    entry.tone,
                  )}
                >
                  {tCards(`rating.${entry.key}`)}
                  <span className="text-[11px] opacity-50">{entry.hotkey}</span>
                </button>
              ))}
            </div>
          ) : (
            <Button variant="primary" size="lg" className="w-full" onClick={() => setFlipped(true)}>
              {tCards('show')}
            </Button>
          )}

          <p className="text-center text-[11px] text-fg-subtle">{tCards('shortcutHint')}</p>
        </div>
      )}
    </section>
  );
};

const MistakesSection = ({
  failed,
  typeLabel,
}: {
  failed: FailedExercise[] | undefined;
  typeLabel: (type: string) => string;
}) => {
  const { t } = useTranslation('today');
  return (
    <section className="space-y-4">
      <h2 className="font-display text-2xl tracking-tightish text-fg">{t('mistakes.heading')}</h2>

      {failed === undefined && <Skeleton rounded="2xl" className="h-28" />}

      {failed !== undefined && failed.length === 0 && (
        <Surface variant="inset">
          <div className="p-6 text-center sm:p-8">
            <p className="text-sm text-fg-muted">{t('mistakes.empty')}</p>
          </div>
        </Surface>
      )}

      {failed !== undefined && failed.length > 0 && (
        <ul className="space-y-3">
          {failed.map((item) => (
            <li key={`${item.slug}:${item.exerciseId}`}>
              <Surface variant="chrome">
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[12px] uppercase tracking-widest text-fg-subtle">
                        {item.title}
                      </span>
                      <Badge tone="neutral" variant="outline">
                        {typeLabel(item.type)}
                      </Badge>
                    </div>
                    <p className="line-clamp-2 text-sm text-fg">{item.prompt}</p>
                  </div>
                  <Link
                    to="/topics/$slug"
                    params={{ slug: item.slug }}
                    search={{ concept: item.conceptId }}
                    className="shrink-0"
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      trailingIcon={<ArrowRight size={15} />}
                    >
                      {t('mistakes.retry')}
                    </Button>
                  </Link>
                </div>
              </Surface>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
