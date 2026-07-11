import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Link } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, m as motion, useReducedMotion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  CalendarRange,
  CheckCircle2,
  Flame,
  Layers,
  RotateCcw,
  Sparkles,
  Repeat2,
  Trophy,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { NextActionTopCard } from '@/components/NextActionCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { celebrate } from '@/components/ui/confetti';
import { cx } from '@/components/ui/cx';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Skeleton } from '@/components/ui/Skeleton';
import { Surface } from '@/components/ui/Surface';
import {
  ACHIEVEMENT_DEFINITIONS,
  useAchievements,
  type AchievementId,
  type TopicReadInput,
} from '@/lib/achievements';
import { reviewFlashcard, type FlashcardRating } from '@/lib/flashcards';
import { getInterviewIndex } from '@/lib/interview';
import { countReadConcepts, useReadConceptsByTopic } from '@/lib/mastery';
import { db, localDayKey } from '@/lib/progress-db';
import {
  compareWeeks,
  lastSevenDays,
  type SparklinePoint,
  type WeeklyComparison,
} from '@/lib/recap';
import { Seo } from '@/lib/seo';
import { useSettings } from '@/lib/settings';
import {
  loadCalibrationReview,
  loadDueAcrossDecks,
  loadDueReExams,
  loadFailedExercises,
  type CalibrationReviewItem,
  type DueCard,
  type DueReExam,
  type FailedExercise,
} from '@/lib/today';
import { useContentLanguage } from '@/lib/topics';
import { useVisibleManifests } from '@/lib/use-manifests';
import { useActivity, useStreakState } from '@/lib/use-progress';
import { useXp, type XpState } from '@/lib/xp';

const ACHIEVEMENT_ICON_BY_ID = new Map<
  AchievementId,
  (typeof ACHIEVEMENT_DEFINITIONS)[number]['icon']
>(ACHIEVEMENT_DEFINITIONS.map((definition) => [definition.id, definition.icon]));

const RATINGS: { key: FlashcardRating; tone: string; hotkey: string }[] = [
  { key: 'again', tone: 'border-err/45 text-err hover:bg-err/10', hotkey: '1' },
  { key: 'hard', tone: 'border-warn/45 text-warn hover:bg-warn/10', hotkey: '2' },
  { key: 'good', tone: 'border-accent/45 text-accent hover:bg-accent/10', hotkey: '3' },
  { key: 'easy', tone: 'border-ok/45 text-ok hover:bg-ok/10', hotkey: '4' },
];

type SessionPhase = 'idle' | 'review' | 'done';

const REVIEW_WEIGHT = 0.25;
const READ_WEIGHT = 0.5;

const STREAK_MILESTONES = [7, 30, 100];

const weightedDailyDone = (
  exercisesPassed: number,
  cardsReviewed: number,
  conceptsRead: number,
): number =>
  Math.round(exercisesPassed + cardsReviewed * REVIEW_WEIGHT + conceptsRead * READ_WEIGHT);

export const TodayPage = () => {
  const { t } = useTranslation('today');
  const { t: tTypes } = useTranslation('interview');
  const { t: tProgress } = useTranslation('progress');
  const language = useContentLanguage();

  const { current: streak, best: bestStreak } = useStreakState();
  const { dailyGoal, weeklyGoalActiveDays } = useSettings();
  const activity = useActivity();
  const xp = useXp();
  const weekly = useMemo(() => compareWeeks(activity), [activity]);
  const sparkline = useMemo(() => lastSevenDays(activity), [activity]);
  const activityToday = useLiveQuery(() => db.activity.get(localDayKey()), [], undefined);
  const solvedToday = activityToday?.exercisesPassed ?? 0;
  const cardsReviewedToday = activityToday?.cardsReviewed ?? 0;
  const conceptsReadToday = activityToday?.conceptsRead ?? 0;
  const doneToday = weightedDailyDone(solvedToday, cardsReviewedToday, conceptsReadToday);
  const goalReached = dailyGoal > 0 && doneToday >= dailyGoal;

  const goalCelebratedRef = useRef(false);
  useEffect(() => {
    if (!goalReached) {
      goalCelebratedRef.current = false;
      return;
    }
    if (goalCelebratedRef.current) return;
    goalCelebratedRef.current = true;
    celebrate('goal-reached');
    toast.success(t('celebrate.goal'));
  }, [goalReached, t]);

  const lastCelebratedStreakRef = useRef<number | null>(null);
  useEffect(() => {
    if (streak <= 0) {
      lastCelebratedStreakRef.current = streak;
      return;
    }
    const previous = lastCelebratedStreakRef.current;
    lastCelebratedStreakRef.current = streak;
    if (previous === null || streak <= previous) return;
    const hitMilestone = STREAK_MILESTONES.includes(streak);
    const newPersonalBest = streak === bestStreak && bestStreak > previous;
    if (!hitMilestone && !newPersonalBest) return;
    celebrate('streak-milestone');
    toast.success(
      hitMilestone
        ? t('celebrate.streakMilestone', { count: streak })
        : t('celebrate.streakBest', { count: streak }),
    );
  }, [streak, bestStreak, t]);

  const manifests = useVisibleManifests();
  const readByTopic = useReadConceptsByTopic();
  const achievementTopics = useMemo<TopicReadInput[]>(
    () =>
      manifests.map((manifest) => ({
        totalConcepts: manifest.concepts.length,
        readConcepts: countReadConcepts(manifest.concepts, readByTopic.get(manifest.slug)),
      })),
    [manifests, readByTopic],
  );

  const [unlockedThisVisit, setUnlockedThisVisit] = useState<AchievementId[]>([]);
  const handleUnlock = useCallback(
    (ids: AchievementId[]) => {
      setUnlockedThisVisit((prev) => [...new Set([...prev, ...ids])]);
      celebrate('streak-milestone');
      const [first, ...rest] = ids;
      if (!first) return;
      const title = tProgress(`achievements.items.${first}.title`);
      toast.success(
        rest.length > 0
          ? t('achievements.unlockedMultiple', { title, count: rest.length })
          : t('achievements.unlocked', { title }),
      );
    },
    [t, tProgress],
  );
  useAchievements(achievementTopics, streak, getInterviewIndex().length, handleUnlock);

  const [due, setDue] = useState<DueCard[] | null | undefined>(undefined);
  const [failed, setFailed] = useState<FailedExercise[] | null | undefined>(undefined);
  const [dueReExams, setDueReExams] = useState<DueReExam[] | null | undefined>(undefined);
  const [calibrationReview, setCalibrationReview] = useState<
    CalibrationReviewItem[] | null | undefined
  >(undefined);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setDue(undefined);
    setFailed(undefined);
    setDueReExams(undefined);
    setCalibrationReview(undefined);
    loadDueAcrossDecks(language)
      .then((cards) => {
        if (!cancelled) setDue(cards);
      })
      .catch(() => {
        if (!cancelled) setDue(null);
      });
    loadFailedExercises(language)
      .then((items) => {
        if (!cancelled) setFailed(items);
      })
      .catch(() => {
        if (!cancelled) setFailed(null);
      });
    loadDueReExams(language)
      .then((items) => {
        if (!cancelled) setDueReExams(items);
      })
      .catch(() => {
        if (!cancelled) setDueReExams(null);
      });
    loadCalibrationReview(language)
      .then((items) => {
        if (!cancelled) setCalibrationReview(items);
      })
      .catch(() => {
        if (!cancelled) setCalibrationReview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [language, retryToken]);

  const retry = useCallback(() => {
    setRetryToken((value) => value + 1);
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <Seo robots="noindex,nofollow" title={t('title')} />
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 eyebrow text-fg-subtle">
          <Sparkles size={12} className="text-accent" />
          <span>{t('eyebrow')}</span>
        </div>
        <h1 className="font-display text-3xl tracking-tightish text-fg">{t('title')}</h1>
        <p className="max-w-prose text-sm text-fg-muted">{t('subtitle')}</p>
      </header>

      <NextActionTopCard />

      <GoalCard
        done={doneToday}
        goal={dailyGoal}
        weeklyGoal={weeklyGoalActiveDays}
        weeklyActiveDays={weekly.thisWeek.activeDays}
      />

      {xp ? <LevelBar xp={xp} /> : null}

      <WeekCard sparkline={sparkline} weekly={weekly} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
        <SummaryStat
          icon={<Repeat2 size={16} className="text-accent" />}
          label={t('summary.cardsReviewed')}
          value={cardsReviewedToday}
        />
      </div>

      {unlockedThisVisit.length > 0 && <NewBadgesRow ids={unlockedThisVisit} />}

      <ReviewSection due={due} onRetry={retry} />

      <ReExamSection items={dueReExams} />

      <MistakesSection
        failed={failed}
        onRetry={retry}
        typeLabel={(type) => tTypes(`exam.types.${type}`, { defaultValue: type })}
      />

      <CalibrationSection items={calibrationReview} />
    </div>
  );
};

const NewBadgesRow = ({ ids }: { ids: AchievementId[] }) => {
  const { t } = useTranslation('today');
  const { t: tProgress } = useTranslation('progress');
  return (
    <Surface variant="accent" rule="left">
      <div className="space-y-3 p-4 sm:p-5">
        <div className="flex items-center gap-2 eyebrow text-fg-subtle">
          <Sparkles size={12} className="text-accent" />
          <span>{t('achievements.heading')}</span>
        </div>
        <ul className="flex flex-wrap gap-2">
          {ids.map((id) => {
            const Icon = ACHIEVEMENT_ICON_BY_ID.get(id);
            return (
              <li
                key={id}
                className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-surface px-3 py-1.5 text-sm text-fg"
              >
                {Icon ? <Icon size={15} className="text-accent" aria-hidden /> : null}
                <span>{tProgress(`achievements.items.${id}.title`)}</span>
              </li>
            );
          })}
        </ul>
        <Link
          to="/progress"
          className="inline-flex min-h-[var(--tap)] items-center gap-1.5 text-sm font-medium text-accent hover:underline"
        >
          {t('achievements.viewAll')}
          <ArrowRight size={15} />
        </Link>
      </div>
    </Surface>
  );
};

const GoalCard = ({
  done,
  goal,
  weeklyGoal,
  weeklyActiveDays,
}: {
  done: number;
  goal: number;
  weeklyGoal: number | undefined;
  weeklyActiveDays: number;
}) => {
  const { t } = useTranslation('today');
  const ratio = goal > 0 ? Math.min(1, done / goal) : 0;
  const reached = goal > 0 && done >= goal;
  const hasWeeklyGoal = typeof weeklyGoal === 'number' && weeklyGoal > 0;
  const weeklyRatio = hasWeeklyGoal ? Math.min(1, weeklyActiveDays / weeklyGoal) : 0;
  const weeklyReached = hasWeeklyGoal && weeklyActiveDays >= weeklyGoal;
  return (
    <Surface variant={reached ? 'accent' : 'chrome'} rule={reached ? 'left' : 'none'}>
      <div className="flex items-center gap-4 p-4 sm:p-5">
        <div className="relative shrink-0">
          <ProgressRing
            value={ratio}
            size={60}
            stroke={5}
            indicatorClassName={reached ? 'text-ok' : 'text-accent'}
          />
          <span className="absolute inset-0 grid place-items-center text-[12px] font-display tabular-nums text-fg">
            {t('goal.progress', { done, goal })}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="eyebrow text-fg-subtle">{t('goal.heading')}</div>
          <p className={cx('mt-1 text-sm font-medium', reached ? 'text-ok' : 'text-fg')}>
            {reached ? t('goal.reached') : t('goal.remaining', { count: Math.max(0, goal - done) })}
          </p>
        </div>
        {hasWeeklyGoal ? (
          <div className="flex shrink-0 items-center gap-3 border-l border-border-base pl-4">
            <div className="relative">
              <ProgressRing
                value={weeklyRatio}
                size={48}
                stroke={4}
                indicatorClassName={weeklyReached ? 'text-ok' : 'text-accent'}
                ariaLabel={t('weeklyGoal.aria', { done: weeklyActiveDays, goal: weeklyGoal })}
              />
              <span className="absolute inset-0 grid place-items-center text-[11px] font-display tabular-nums text-fg">
                {t('weeklyGoal.progress', { done: weeklyActiveDays, goal: weeklyGoal })}
              </span>
            </div>
            <div className="hidden min-w-0 sm:block">
              <div className="eyebrow text-fg-subtle">{t('weeklyGoal.heading')}</div>
              <p
                className={cx(
                  'mt-1 text-[12px] font-medium',
                  weeklyReached ? 'text-ok' : 'text-fg-muted',
                )}
              >
                {weeklyReached
                  ? t('weeklyGoal.reached')
                  : t('weeklyGoal.daysLabel', { count: weeklyActiveDays })}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </Surface>
  );
};

const LevelBar = ({ xp }: { xp: XpState }) => {
  const { t } = useTranslation('today');
  const percent = Math.round(xp.ratioToNext * 100);
  return (
    <Surface variant="chrome">
      <div className="flex items-center gap-4 p-4 sm:p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
          <Trophy size={18} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-fg">
              {t('level.label', { level: xp.level })}
            </span>
            <span className="text-[12px] tabular-nums text-fg-subtle">
              {t('level.xp', { xp: xp.total })}
            </span>
          </div>
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('level.nextAria', { remaining: Math.max(0, xp.nextLevelAt - xp.total) })}
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-slow ease-out"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-fg-subtle tabular-nums">
            {t('level.toNext', { remaining: Math.max(0, xp.nextLevelAt - xp.total) })}
          </p>
        </div>
      </div>
    </Surface>
  );
};

const WeekCard = ({
  sparkline,
  weekly,
}: {
  sparkline: SparklinePoint[];
  weekly: WeeklyComparison;
}) => {
  const { t } = useTranslation('today');
  const max = sparkline.reduce((peak, point) => Math.max(peak, point.value), 0);
  const tally = [
    { key: 'concepts', value: weekly.thisWeek.conceptsRead },
    { key: 'exercises', value: weekly.thisWeek.exercisesPassed },
    { key: 'cards', value: weekly.thisWeek.cardsReviewed },
  ] as const;
  return (
    <Surface variant="chrome">
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex items-center gap-2 eyebrow text-fg-subtle">
          <CalendarRange size={12} className="text-accent" aria-hidden />
          <span>{t('week.heading')}</span>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {tally.map((entry) => (
            <div key={entry.key} className="min-w-0">
              <div className="font-display text-2xl leading-none tabular-nums text-fg">
                {entry.value}
              </div>
              <div className="mt-1 text-[11px] uppercase tracking-widest text-fg-subtle">
                {t(`week.${entry.key}`)}
              </div>
            </div>
          ))}
        </div>
        <Sparkline points={sparkline} max={max} />
      </div>
    </Surface>
  );
};

const Sparkline = ({ points, max }: { points: SparklinePoint[]; max: number }) => {
  const { t } = useTranslation('today');
  return (
    <div className="flex h-14 items-end gap-1.5" role="img" aria-label={t('week.sparklineAria')}>
      {points.map((point) => {
        const heightPercent = max > 0 ? Math.max(6, (point.value / max) * 100) : 6;
        return (
          <div
            key={point.day}
            className={cx(
              'flex-1 rounded-sm transition-[height] duration-med ease-standard',
              point.value > 0 ? (point.isToday ? 'bg-accent' : 'bg-accent/45') : 'bg-surface-2',
            )}
            style={{ height: `${heightPercent}%` }}
          />
        );
      })}
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

const ReviewSection = ({
  due,
  onRetry,
}: {
  due: DueCard[] | null | undefined;
  onRetry: () => void;
}) => {
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

  useEffect(() => {
    if (phase === 'done') {
      celebrate('queue-cleared');
    }
  }, [phase]);

  const rate = useCallback(
    (rating: FlashcardRating) => {
      if (!current) return;
      void reviewFlashcard(current.deckSlug, current.card.id, rating);
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

      {due === null && (
        <EmptyState
          icon={<AlertTriangle size={22} className="text-warn" />}
          title={t('error.dueTitle')}
          body={t('error.dueBody')}
          primaryAction={
            <Button
              variant="primary"
              size="lg"
              className="w-full sm:w-auto"
              leadingIcon={<RotateCcw size={16} />}
              onClick={onRetry}
            >
              {t('error.retry')}
            </Button>
          }
        />
      )}

      {due != null && phase === 'idle' && total === 0 && (
        <EmptyState
          icon={<CheckCircle2 size={22} className="text-ok" />}
          title={t('due.emptyTitle')}
          body={t('due.emptyBody')}
          primaryAction={
            <Link to="/flashcards" className="block w-full sm:w-auto">
              <Button
                variant="primary"
                size="lg"
                className="w-full sm:w-auto"
                leadingIcon={<Layers size={16} />}
              >
                {t('due.browseDecks')}
              </Button>
            </Link>
          }
        />
      )}

      {due != null && phase === 'idle' && total > 0 && (
        <Surface variant="inset" rule="top">
          <div className="flex flex-col items-center gap-4 p-6 text-center sm:p-8">
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
                  <span className="truncate text-[11px] text-fg-subtle">{current.sourceLabel}</span>
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
  onRetry,
  typeLabel,
}: {
  failed: FailedExercise[] | null | undefined;
  onRetry: () => void;
  typeLabel: (type: string) => string;
}) => {
  const { t } = useTranslation('today');
  return (
    <section className="space-y-4">
      <h2 className="font-display text-2xl tracking-tightish text-fg">{t('mistakes.heading')}</h2>

      {failed === undefined && <Skeleton rounded="2xl" className="h-28" />}

      {failed === null && (
        <EmptyState
          icon={<AlertTriangle size={22} className="text-warn" />}
          title={t('error.mistakesTitle')}
          body={t('error.mistakesBody')}
          primaryAction={
            <Button
              variant="primary"
              size="md"
              className="w-full min-h-[var(--tap)] sm:min-h-0 sm:w-auto"
              leadingIcon={<RotateCcw size={15} />}
              onClick={onRetry}
            >
              {t('error.retry')}
            </Button>
          }
        />
      )}

      {failed != null && failed.length === 0 && (
        <EmptyState
          icon={<CheckCircle2 size={22} className="text-ok" />}
          title={t('mistakes.emptyTitle')}
          body={t('mistakes.emptyBody')}
          primaryAction={
            <Link to="/" hash="topics" className="block w-full sm:w-auto">
              <Button
                variant="outline"
                size="md"
                className="w-full min-h-[var(--tap)] sm:min-h-0 sm:w-auto"
                trailingIcon={<ArrowRight size={15} />}
              >
                {t('mistakes.exploreTopics')}
              </Button>
            </Link>
          }
        />
      )}

      {failed != null && failed.length > 0 && (
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

const MS_PER_DAY = 86_400_000;

function ReExamSection({ items }: { items: DueReExam[] | null | undefined }) {
  const { t } = useTranslation('today');
  if (!items || items.length === 0) return null;
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="font-display text-2xl tracking-tightish text-fg">{t('reexam.heading')}</h2>
        <p className="text-sm text-fg-muted">{t('reexam.hint')}</p>
      </div>
      <ul className="space-y-3">
        {items.map((item) => {
          const daysOverdue = Math.max(
            0,
            Math.floor((Date.now() - new Date(item.due).getTime()) / MS_PER_DAY),
          );
          return (
            <li key={`${item.topicSlug}:${item.conceptId}`}>
              <Surface variant="chrome">
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[12px] uppercase tracking-widest text-fg-subtle">
                        {item.topicTitle}
                      </span>
                      <Badge tone="accent" variant="outline">
                        {t('reexam.badge')}
                      </Badge>
                    </div>
                    <p className="line-clamp-2 text-sm text-fg">{item.conceptTitle}</p>
                    {daysOverdue > 0 && (
                      <p className="text-[12px] text-fg-subtle">
                        {t('reexam.overdue', { count: daysOverdue })}
                      </p>
                    )}
                  </div>
                  <Link
                    to="/topics/$slug"
                    params={{ slug: item.topicSlug }}
                    search={{ concept: item.conceptId }}
                    className="shrink-0"
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                      trailingIcon={<ArrowRight size={15} />}
                    >
                      {t('reexam.retake')}
                    </Button>
                  </Link>
                </div>
              </Surface>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const calibrationBadgeTone = (flag: CalibrationReviewItem['flag']): 'danger' | 'neutral' =>
  flag === 'high-confidence-error' ? 'danger' : 'neutral';

const calibrationBadgeLabelKey = (flag: CalibrationReviewItem['flag']): string =>
  flag === 'high-confidence-error'
    ? 'calibrationReview.highConfidenceError'
    : 'calibrationReview.fragile';

function CalibrationSection({ items }: { items: CalibrationReviewItem[] | null | undefined }) {
  const { t } = useTranslation('today');
  if (!items || items.length === 0) return null;
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="font-display text-2xl tracking-tightish text-fg">
          {t('calibrationReview.heading')}
        </h2>
        <p className="text-sm text-fg-muted">{t('calibrationReview.hint')}</p>
      </div>
      <ul className="space-y-3">
        {items.map((item) => {
          const tone = calibrationBadgeTone(item.flag);
          return (
            <li key={`${item.topicSlug}:${item.exerciseId}`}>
              <Surface variant="chrome">
                <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[12px] uppercase tracking-widest text-fg-subtle">
                        {item.topicTitle}
                      </span>
                      <Badge tone={tone} variant={tone === 'danger' ? 'soft' : 'outline'}>
                        {t(calibrationBadgeLabelKey(item.flag))}
                      </Badge>
                    </div>
                    <p className="line-clamp-2 text-sm text-fg">{item.exerciseTitle}</p>
                  </div>
                  <Link
                    to="/topics/$slug"
                    params={{ slug: item.topicSlug }}
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
          );
        })}
      </ul>
    </section>
  );
}
