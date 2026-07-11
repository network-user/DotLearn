import { useMemo, useRef } from 'react';
import type { ChangeEvent } from 'react';

import type { TopicManifest } from '@dotlearn/contracts';
import {
  calibrationByTopic,
  summarizeCalibration,
  type CalibrationSample,
} from '@dotlearn/lesson-engine';
import { Link } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Compass,
  Download,
  Gauge,
  Minus,
  Target,
  Upload,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { ActivityHeatmap } from '@/components/ActivityHeatmap';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { Button } from '@/components/ui/Button';
import { DualProgressBar } from '@/components/ui/DualProgressBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { useAchievements, type AchievementView, type TopicReadInput } from '@/lib/achievements';
import { interviewQuestions } from '@/lib/interview';
import {
  weakestConcepts,
  type ExerciseAttemptInput,
  type WeakConceptInput,
} from '@/lib/learner-model';
import { computeMastery, countReadConcepts, useReadConceptsByTopic } from '@/lib/mastery';
import { db } from '@/lib/progress-db';
import { useRecallByTopic } from '@/lib/retention';
import {
  MAX_IMPORT_FILE_BYTES,
  ProgressImportError,
  downloadProgressExport,
  exportProgress,
  importProgress,
} from '@/lib/progress-io';
import { compareWeeks, type WeeklyComparison } from '@/lib/recap';
import { useSync } from '@/lib/sync/engine';
import { effectiveLanguage, useContentLanguage } from '@/lib/topics';
import { useVisibleManifests } from '@/lib/use-manifests';
import { useBookmarks } from '@/lib/use-learning';
import { useInterviewStudiedIds } from '@/lib/use-interview';
import { useActivity, useStreakState } from '@/lib/use-progress';
import { useXp, type XpState } from '@/lib/xp';
import topicStats from 'virtual:topic-stats';

interface TopicRow {
  manifest: TopicManifest;
  total: number;
  passed: number;
  failed: number;
  readConcepts: number;
  lastAttemptAt: string | undefined;
}

const useRelativeFormatter = () => {
  const { t } = useTranslation('common');
  return (iso: string | undefined): string => {
    if (!iso) {
      return t('ago.noAttempts');
    }
    const now = Date.now();
    const past = new Date(iso).getTime();
    const seconds = Math.max(1, Math.floor((now - past) / 1000));
    if (seconds < 60) return t('ago.seconds', { count: seconds });
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return t('ago.minutes', { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('ago.hours', { count: hours });
    const days = Math.floor(hours / 24);
    if (days < 30) return t('ago.days', { count: days });
    const months = Math.floor(days / 30);
    return t('ago.months', { count: months });
  };
};

const SyncStatusLine = () => {
  const { t } = useTranslation('progress');
  const sync = useSync();
  const formatRelative = useRelativeFormatter();

  if (!sync.linked) {
    return (
      <p className="mt-1 text-xs">
        <Link to="/settings" className="text-accent hover:underline">
          {t('sync.notLinked')}
        </Link>
      </p>
    );
  }

  const when =
    sync.lastSyncAt !== null ? formatRelative(new Date(sync.lastSyncAt).toISOString()) : '—';
  const dotClass =
    sync.phase === 'error' || sync.phase === 'too-large'
      ? 'bg-err'
      : sync.phase === 'syncing'
        ? 'bg-accent animate-pulse'
        : 'bg-ok';

  return (
    <p className="mt-1 flex items-center gap-1.5 text-xs text-fg-subtle">
      <span aria-hidden className={'size-1.5 rounded-full ' + dotClass} />
      {t('sync.linked', { when })}
      {' · '}
      <Link to="/settings" className="text-accent hover:underline">
        {t('sync.manage')}
      </Link>
    </p>
  );
};

export const ProgressPage = () => {
  const { t } = useTranslation('progress');
  const formatRelative = useRelativeFormatter();
  const manifests = useVisibleManifests();
  const activity = useActivity();
  const xp = useXp();
  const weekly = useMemo(() => compareWeeks(activity), [activity]);
  const { current: streak, best: bestStreak } = useStreakState();
  const progressRecords = useLiveQuery(() => db.progress.toArray(), [], []);
  const studiedIds = useInterviewStudiedIds();
  const bookmarks = useBookmarks();
  const readByTopic = useReadConceptsByTopic();
  const recallByTopic = useRecallByTopic();
  const attemptEvents = useLiveQuery(() => db.attemptEvents.toArray(), [], []);
  const checkpointResults = useLiveQuery(() => db.checkpointResults.toArray(), [], []);
  const noteCount = useLiveQuery(() => db.conceptNotes.count(), [], 0);
  const highlightCount = useLiveQuery(() => db.highlights.count(), [], 0);
  const userCardCount = useLiveQuery(() => db.userCards.count(), [], 0);

  const language = useContentLanguage();

  const rows = useMemo<TopicRow[]>(() => {
    const byTopic = new Map<string, { passed: number; failed: number; lastAttemptAt?: string }>();
    for (const record of progressRecords ?? []) {
      const entry = byTopic.get(record.topicSlug) ?? { passed: 0, failed: 0 };
      if (record.status === 'pass') {
        entry.passed += 1;
      } else {
        entry.failed += 1;
      }
      if (!entry.lastAttemptAt || record.lastAttemptAt > entry.lastAttemptAt) {
        entry.lastAttemptAt = record.lastAttemptAt;
      }
      byTopic.set(record.topicSlug, entry);
    }
    return manifests.map((manifest) => {
      const total = topicStats[manifest.slug]?.[effectiveLanguage(manifest, language)] ?? 0;
      const stats = byTopic.get(manifest.slug) ?? { passed: 0, failed: 0 };
      return {
        manifest,
        total,
        passed: stats.passed,
        failed: stats.failed,
        readConcepts: countReadConcepts(manifest.concepts, readByTopic.get(manifest.slug)),
        lastAttemptAt: stats.lastAttemptAt,
      };
    });
  }, [manifests, progressRecords, readByTopic, language]);

  const resolvedBookmarks = useMemo(() => {
    return bookmarks
      .map((bookmark) => {
        const manifest = manifests.find((entry) => entry.slug === bookmark.topicSlug);
        if (!manifest) return undefined;
        const concept = manifest.concepts.find((entry) => entry.id === bookmark.conceptId);
        if (!concept) return undefined;
        return {
          id: bookmark.id,
          slug: bookmark.topicSlug,
          conceptId: bookmark.conceptId,
          topicTitle: manifest.title,
          conceptTitle: concept.title,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);
  }, [bookmarks, manifests]);

  const weakConcepts = useMemo(() => {
    const byTopic = new Map<string, ExerciseAttemptInput[]>();
    for (const event of attemptEvents ?? []) {
      if (!event.at || !event.concept) continue;
      const difficulty = Number(event.difficulty);
      const bucket = byTopic.get(event.topicSlug) ?? [];
      bucket.push({
        exerciseId: event.exerciseId,
        conceptId: event.concept,
        difficulty: Number.isFinite(difficulty) ? difficulty : 1,
        status: event.status,
        attempts: 1,
        lastAttemptAt: event.at,
      });
      byTopic.set(event.topicSlug, bucket);
    }
    const inputs: WeakConceptInput[] = [...byTopic.entries()].map(([topicSlug, attempts]) => ({
      topicSlug,
      attempts,
    }));
    const manifestBySlug = new Map(manifests.map((manifest) => [manifest.slug, manifest]));
    return weakestConcepts(inputs, 5)
      .map((weak) => {
        const manifest = manifestBySlug.get(weak.topicSlug);
        if (!manifest) return undefined;
        const concept = manifest.concepts.find((entry) => entry.id === weak.conceptId);
        if (!concept) return undefined;
        return {
          topicSlug: weak.topicSlug,
          conceptId: weak.conceptId,
          topicTitle: manifest.title,
          conceptTitle: concept.title,
          strengthPercent: Math.round(weak.strength * 100),
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined);
  }, [attemptEvents, manifests]);

  const calibrationSamples = useMemo<CalibrationSample[]>(() => {
    const samples: CalibrationSample[] = [];
    for (const event of attemptEvents ?? []) {
      if (!event.confidence) continue;
      samples.push({
        confidence: event.confidence,
        correct: event.status === 'pass',
        topicSlug: event.topicSlug,
      });
    }
    for (const result of checkpointResults ?? []) {
      if (!result.confidence) continue;
      samples.push({
        confidence: result.confidence,
        correct: result.status === 'pass',
        topicSlug: result.topicSlug,
      });
    }
    return samples;
  }, [attemptEvents, checkpointResults]);

  const calibration = useMemo(() => summarizeCalibration(calibrationSamples), [calibrationSamples]);

  const calibrationTopicRows = useMemo(() => {
    const manifestBySlug = new Map(manifests.map((manifest) => [manifest.slug, manifest]));
    return [...calibrationByTopic(calibrationSamples).entries()]
      .map(([topicSlug, summary]) => {
        const sureBucket = summary.buckets.find((bucket) => bucket.confidence === 'sure');
        if (!sureBucket || sureBucket.count === 0) return undefined;
        return {
          topicSlug,
          topicTitle: manifestBySlug.get(topicSlug)?.title ?? topicSlug,
          accuracy: sureBucket.accuracy,
          expectedAccuracy: sureBucket.expectedAccuracy,
          gap: sureBucket.gap,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== undefined && entry.gap < 0)
      .sort((a, b) => a.gap - b.gap)
      .slice(0, 3);
  }, [calibrationSamples, manifests]);

  const totalAttempted = useMemo(
    () => activity.reduce((sum, entry) => sum + entry.exercisesAttempted, 0),
    [activity],
  );
  const totalPassed = useMemo(
    () => (progressRecords ?? []).filter((record) => record.status === 'pass').length,
    [progressRecords],
  );
  const cardsReviewed = useMemo(
    () => activity.reduce((sum, entry) => sum + (entry.cardsReviewed ?? 0), 0),
    [activity],
  );
  const activeDays = activity.filter(
    (entry) =>
      entry.exercisesAttempted > 0 ||
      (entry.interviewStudied ?? 0) > 0 ||
      (entry.cardsReviewed ?? 0) > 0 ||
      (entry.conceptsRead ?? 0) > 0,
  ).length;
  const interviewStudied = studiedIds.size;
  const interviewTotal = interviewQuestions.length;
  const hasProgress = totalPassed > 0 || totalAttempted > 0;
  const recommendedTopic = rows[0]?.manifest;

  const achievementTopics = useMemo<TopicReadInput[]>(
    () =>
      rows.map((row) => ({
        totalConcepts: row.manifest.concepts.length,
        readConcepts: row.readConcepts,
      })),
    [rows],
  );
  const achievements = useAchievements(achievementTopics, streak, interviewTotal);

  const overallAccuracy = useMemo(() => {
    const events = attemptEvents ?? [];
    if (events.length === 0) return 0;
    return events.filter((event) => event.status === 'pass').length / events.length;
  }, [attemptEvents]);
  const exerciseMinutes = useMemo(
    () =>
      Math.round((attemptEvents ?? []).reduce((sum, e) => sum + (e.durationMs ?? 0), 0) / 60_000),
    [attemptEvents],
  );
  const focusBlocksTotal = useMemo(
    () => activity.reduce((sum, entry) => sum + (entry.focusBlocks ?? 0), 0),
    [activity],
  );
  const libraryItemsCount = noteCount + bookmarks.length + highlightCount + userCardCount;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleExport = async (): Promise<void> => {
    try {
      downloadProgressExport(await exportProgress());
      toast.success(t('data.exported'));
    } catch {
      toast.error(t('data.exportError'));
    }
  };

  const handleImportFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > MAX_IMPORT_FILE_BYTES) {
        throw new ProgressImportError('too-large');
      }
      const parsed: unknown = JSON.parse(await file.text());
      const { imported } = await importProgress(parsed);
      toast.success(t('data.imported', { count: imported }));
    } catch (error) {
      if (error instanceof ProgressImportError || error instanceof SyntaxError) {
        toast.error(t('data.importInvalid'));
      } else {
        toast.error(t('data.importError'));
      }
    }
  };

  return (
    <div className="space-y-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-2 text-sm text-fg-muted max-w-2xl">{t('subtitle')}</p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatTile label={t('stats.solved')} value={totalPassed} hint={t('stats.solvedHint')} />
        <StatTile
          label={t('stats.attempts')}
          value={totalAttempted}
          hint={t('stats.attemptsHint')}
        />
        <StatTile
          label={t('stats.cardsReviewed')}
          value={cardsReviewed}
          hint={t('stats.cardsReviewedHint')}
        />
        <StatTile
          label={t('stats.activeDays')}
          value={activeDays}
          hint={t('stats.activeDaysHint')}
        />
        <StatTile
          label={t('stats.streak')}
          value={streak}
          hint={t('stats.bestStreak', { count: bestStreak })}
          emphasis
        />
      </section>

      <section className="space-y-3">
        <h2 className="eyebrow border-b border-border-base pb-2">{t('metrics.heading')}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatTile
            label={t('stats.accuracy')}
            value={Math.round(overallAccuracy * 100)}
            hint={t('stats.accuracyHint', { count: attemptEvents?.length ?? 0 })}
          />
          <StatTile
            label={t('stats.exerciseTime')}
            value={exerciseMinutes}
            hint={t('stats.exerciseTimeHint', {
              hours: Math.floor(exerciseMinutes / 60),
              minutes: exerciseMinutes % 60,
            })}
          />
          <StatTile
            label={t('stats.focusBlocks')}
            value={focusBlocksTotal}
            hint={t('stats.focusBlocksHint')}
          />
          <StatTile
            label={t('stats.libraryItems')}
            value={libraryItemsCount}
            hint={t('stats.libraryItemsHint')}
          />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {xp ? <LevelPanel xp={xp} /> : null}
        <div className="lg:col-span-2">
          <WeeklyRecap weekly={weekly} />
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 border-b border-border-base pb-2">
          <h2 className="eyebrow">{t('achievements.heading')}</h2>
          <span className="text-xs text-fg-subtle tabular-nums">
            {achievements.unlockedCount}/{achievements.total}
          </span>
        </div>
        <AchievementsGrid views={achievements.views} />
      </section>

      <section className="space-y-3">
        <h2 className="eyebrow border-b border-border-base pb-2">{t('activity')}</h2>
        <div className="rounded-lg border border-border-base bg-surface p-5 overflow-x-auto">
          <div className="min-w-[360px]">
            <ActivityHeatmap activity={activity} weeks={14} />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="eyebrow border-b border-border-base pb-2">{t('interview.heading')}</h2>
        <Link
          to="/interview"
          className="block rounded-lg border border-border-base bg-surface hover:border-border-strong hover:bg-surface-2/50 transition p-5"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-fg">{t('interview.heading')}</h3>
            <span className="text-xs text-fg-subtle tabular-nums">
              {interviewStudied}/{interviewTotal}
            </span>
          </div>
          <ProgressBar passed={interviewStudied} total={interviewTotal} />
          <p className="mt-2 text-xs text-fg-subtle">
            {t('interview.studied', { studied: interviewStudied, total: interviewTotal })} ·{' '}
            {t('interview.open')}
          </p>
        </Link>
      </section>

      {weakConcepts.length > 0 && (
        <section className="space-y-3">
          <h2 className="eyebrow border-b border-border-base pb-2">{t('weakest.heading')}</h2>
          <p className="text-xs text-fg-subtle">{t('weakest.hint')}</p>
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {weakConcepts.map((weak) => (
              <li key={`${weak.topicSlug}:${weak.conceptId}`}>
                <Link
                  to="/topics/$slug"
                  params={{ slug: weak.topicSlug }}
                  search={{ concept: weak.conceptId }}
                  className="flex items-center gap-3 rounded-lg border border-border-base bg-surface hover:border-border-strong hover:bg-surface-2/50 transition p-4"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-warn/[0.1] text-warn">
                    <Target size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-fg">{weak.conceptTitle}</div>
                    <div className="truncate text-xs text-fg-subtle">{weak.topicTitle}</div>
                  </div>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-fg-subtle tabular-nums">
                    {t('weakest.strength', { percent: weak.strengthPercent })}
                    <ArrowRight size={14} className="text-accent" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="eyebrow border-b border-border-base pb-2">{t('calibration.heading')}</h2>
        <p className="text-xs text-fg-subtle">{t('calibration.hint')}</p>
        {calibration.total === 0 ? (
          <EmptyState
            icon={<Gauge size={22} className="text-accent" />}
            title={t('calibration.empty')}
          />
        ) : (
          <div className="rounded-lg border border-border-base bg-surface p-5 space-y-5">
            <div className="flex items-center gap-5">
              <div className="relative shrink-0">
                <ProgressRing value={calibration.calibrationScore} size={72} stroke={6} />
                <span className="absolute inset-0 grid place-items-center font-display text-lg tabular-nums text-fg">
                  {Math.round(calibration.calibrationScore * 100)}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-fg-subtle">
                  {t('calibration.score')}
                </p>
                <p className="mt-1 text-xs text-fg-subtle tabular-nums">
                  {t('calibration.samples', { count: calibration.total })}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-subtle tabular-nums">
                  <span>
                    {t('calibration.overconfident', {
                      percent: Math.round(calibration.overconfidenceRate * 100),
                    })}
                  </span>
                  <span>
                    {t('calibration.underconfident', {
                      percent: Math.round(calibration.underconfidenceRate * 100),
                    })}
                  </span>
                </div>
              </div>
            </div>

            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {calibration.buckets.map((bucket) => (
                <li
                  key={bucket.confidence}
                  className="rounded-lg border border-border-base bg-surface-2/40 p-3"
                >
                  <p className="text-xs font-medium text-fg">
                    {t(`calibration.bucket.${bucket.confidence}`)}
                  </p>
                  <DualProgressBar
                    reading={bucket.expectedAccuracy}
                    solving={bucket.accuracy}
                    className="mt-2"
                    ariaLabel={t(`calibration.bucket.${bucket.confidence}`)}
                  />
                  <p className="mt-2 text-[11px] text-fg-subtle tabular-nums">
                    {t('calibration.accuracy', { percent: Math.round(bucket.accuracy * 100) })} ·{' '}
                    {t('calibration.expected', {
                      percent: Math.round(bucket.expectedAccuracy * 100),
                    })}
                  </p>
                  <p className="mt-0.5 text-[11px] text-fg-subtle tabular-nums">
                    {t('calibration.samples', { count: bucket.count })}
                  </p>
                </li>
              ))}
            </ul>

            {calibrationTopicRows.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide text-fg-subtle">
                  {t('calibration.byTopic')}
                </p>
                <ul className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {calibrationTopicRows.map((row) => (
                    <li
                      key={row.topicSlug}
                      className="rounded-lg border border-border-base bg-surface-2/40 p-3"
                    >
                      <p className="truncate text-xs font-medium text-fg">{row.topicTitle}</p>
                      <p className="mt-1 text-[11px] text-fg-subtle tabular-nums">
                        {t('calibration.accuracy', { percent: Math.round(row.accuracy * 100) })} ·{' '}
                        {t('calibration.expected', {
                          percent: Math.round(row.expectedAccuracy * 100),
                        })}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {resolvedBookmarks.length > 0 && (
        <section className="space-y-3">
          <h2 className="eyebrow border-b border-border-base pb-2">{t('bookmarks.heading')}</h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {resolvedBookmarks.map((bookmark) => (
              <li key={bookmark.id}>
                <Link
                  to="/topics/$slug"
                  params={{ slug: bookmark.slug }}
                  search={{ concept: bookmark.conceptId }}
                  className="flex items-center gap-3 rounded-lg border border-border-base bg-surface hover:border-border-strong hover:bg-surface-2/50 transition p-4"
                >
                  <Bookmark size={16} className="text-accent shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-fg truncate">
                      {bookmark.conceptTitle}
                    </div>
                    <div className="text-xs text-fg-subtle truncate">{bookmark.topicTitle}</div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 border-b border-border-base pb-2">
          <h2 className="eyebrow">{t('topics')}</h2>
          <div className="flex items-center gap-3 text-[10px] text-fg-subtle">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full bg-accent/40" />
              {t('legend.reading')}
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full bg-accent" />
              {t('legend.solving')}
            </span>
          </div>
        </div>
        {rows.length === 0 ? (
          <EmptyState
            icon={<Compass size={22} className="text-accent" />}
            title={t('empty.noTopicsTitle')}
            body={t('empty.noTopicsBody')}
            primaryAction={
              <Link to="/" hash="topics" className="block w-full sm:w-auto">
                <Button
                  variant="primary"
                  size="md"
                  className="w-full min-h-[var(--tap)] sm:min-h-0 sm:w-auto"
                  trailingIcon={<ArrowRight size={15} />}
                >
                  {t('empty.exploreTopics')}
                </Button>
              </Link>
            }
          />
        ) : !hasProgress ? (
          <EmptyState
            icon={<Compass size={22} className="text-accent" />}
            title={t('empty.noProgressTitle')}
            body={t('empty.noProgressBody')}
            primaryAction={
              recommendedTopic ? (
                <Link
                  to="/topics/$slug"
                  params={{ slug: recommendedTopic.slug }}
                  className="block w-full sm:w-auto"
                >
                  <Button
                    variant="primary"
                    size="md"
                    className="w-full min-h-[var(--tap)] sm:min-h-0 sm:w-auto"
                    trailingIcon={<ArrowRight size={15} />}
                  >
                    {t('empty.startRecommended')}
                  </Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rows.map((row) => {
              const totalConcepts = row.manifest.concepts.length;
              const m = computeMastery(row.readConcepts, totalConcepts, row.passed, row.total);
              const masteryPercent = Math.round(m.mastery * 100);
              const recall = recallByTopic.get(row.manifest.slug);
              const showRecall = recall !== undefined && recall.reviewedCards > 0;
              return (
                <li key={row.manifest.slug}>
                  <Link
                    to="/topics/$slug"
                    params={{ slug: row.manifest.slug }}
                    className="block rounded-lg border border-border-base bg-surface hover:border-border-strong hover:bg-surface-2/50 transition p-5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold text-fg truncate">{row.manifest.title}</h3>
                      <span className="text-xs font-medium text-fg tabular-nums shrink-0">
                        {masteryPercent}%
                      </span>
                    </div>
                    <DualProgressBar
                      reading={m.readingRatio}
                      solving={m.solvingRatio}
                      className="mt-3"
                      ariaLabel={t('masteryAria', { percent: masteryPercent })}
                    />
                    <p className="mt-2 text-xs text-fg-subtle tabular-nums">
                      {t('readSolved', {
                        read: row.readConcepts,
                        rt: totalConcepts,
                        passed: row.passed,
                        pt: row.total,
                      })}
                    </p>
                    <p className="mt-1 text-xs text-fg-subtle">
                      {t('lastAttempt', {
                        when: formatRelative(row.lastAttemptAt),
                        count: row.failed,
                      })}
                    </p>
                    {showRecall && (
                      <p className="mt-1 text-xs text-fg-subtle tabular-nums">
                        {t('recallLine', {
                          percent: Math.round(recall.recall * 100),
                          due: recall.dueCards,
                        })}
                      </p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="eyebrow border-b border-border-base pb-2">{t('data.heading')}</h2>
        <div className="rounded-lg border border-border-base bg-surface p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-fg-muted max-w-prose">{t('data.hint')}</p>
            <SyncStatusLine />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void handleExport()}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-md border border-border-strong px-3 min-h-[var(--tap)] text-sm text-fg hover:bg-surface-2 transition-colors"
            >
              <Upload size={15} />
              {t('data.export')}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-md border border-border-strong px-3 min-h-[var(--tap)] text-sm text-fg hover:bg-surface-2 transition-colors"
            >
              <Download size={15} />
              {t('data.import')}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => void handleImportFile(event)}
            />
          </div>
        </div>
      </section>
    </div>
  );
};

interface StatTileProps {
  label: string;
  value: number;
  hint: string;
  emphasis?: boolean;
}

const LevelPanel = ({ xp }: { xp: XpState }) => {
  const { t } = useTranslation('progress');
  const percent = Math.round(xp.ratioToNext * 100);
  return (
    <div className="flex h-full items-center gap-5 rounded-lg border border-border-base bg-surface p-5">
      <div className="relative shrink-0">
        <ProgressRing value={xp.ratioToNext} size={84} stroke={7} />
        <span className="absolute inset-0 grid place-items-center font-display text-2xl tabular-nums text-fg">
          {xp.level}
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-fg-subtle">{t('xp.heading')}</p>
        <p className="mt-1 font-display text-2xl tabular-nums text-fg">
          {t('xp.total', { xp: xp.total })}
        </p>
        <p className="mt-1 text-[11px] text-fg-subtle tabular-nums">
          {t('xp.toNext', { remaining: Math.max(0, xp.nextLevelAt - xp.total), percent })}
        </p>
      </div>
    </div>
  );
};

const DELTA_ROWS = ['conceptsRead', 'exercisesPassed', 'cardsReviewed', 'activeDays'] as const;

const WeeklyRecap = ({ weekly }: { weekly: WeeklyComparison }) => {
  const { t } = useTranslation('progress');
  return (
    <section className="flex h-full flex-col rounded-lg border border-border-base bg-surface p-5">
      <div className="flex items-center justify-between gap-3 border-b border-border-base pb-2">
        <h2 className="eyebrow">{t('recap.heading')}</h2>
        <span className="text-[11px] text-fg-subtle">{t('recap.vsLast')}</span>
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-3">
        {DELTA_ROWS.map((row) => (
          <RecapRow
            key={row}
            label={t(`recap.${row}`)}
            value={weekly.thisWeek[row]}
            delta={weekly.delta[row]}
            hasLast={weekly.lastWeek !== undefined}
          />
        ))}
      </ul>
    </section>
  );
};

const RecapRow = ({
  label,
  value,
  delta,
  hasLast,
}: {
  label: string;
  value: number;
  delta: number;
  hasLast: boolean;
}) => {
  const { t } = useTranslation('progress');
  const tone = delta > 0 ? 'text-ok' : delta < 0 ? 'text-err' : 'text-fg-subtle';
  const Icon = delta > 0 ? ArrowUpRight : delta < 0 ? ArrowDownRight : Minus;
  return (
    <li className="rounded-lg border border-border-base bg-surface-2/40 p-3">
      <p className="text-[11px] uppercase tracking-wide text-fg-subtle">{label}</p>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className="font-display text-2xl tabular-nums text-fg">{value}</span>
        {hasLast ? (
          <span className={'inline-flex items-center gap-0.5 text-xs tabular-nums ' + tone}>
            <Icon size={13} aria-hidden />
            {delta === 0 ? t('recap.same') : Math.abs(delta)}
          </span>
        ) : (
          <span className="text-[11px] text-fg-subtle">{t('recap.new')}</span>
        )}
      </div>
    </li>
  );
};

const StatTile = ({ label, value, hint, emphasis }: StatTileProps) => (
  <div
    className={
      'rounded-lg border p-4 ' +
      (emphasis
        ? 'border-t-2 border-t-accent border-border-base bg-accent/[0.06]'
        : 'border-border-base bg-surface')
    }
  >
    <p className="text-xs uppercase tracking-wide text-fg-subtle">{label}</p>
    <p className="mt-1 text-3xl font-semibold text-fg tabular-nums">
      <AnimatedNumber value={value} />
    </p>
    <p className="mt-1 text-[11px] text-fg-subtle">{hint}</p>
  </div>
);

const TIER_UNLOCKED_CLASS: Record<AchievementView['tier'], string> = {
  bronze: 'border-amber-600/40 bg-amber-500/[0.07] text-amber-600 dark:text-amber-400',
  silver: 'border-slate-400/45 bg-slate-400/[0.08] text-slate-500 dark:text-slate-300',
  gold: 'border-yellow-500/45 bg-yellow-400/[0.1] text-yellow-600 dark:text-yellow-400',
};

const AchievementsGrid = ({ views }: { views: AchievementView[] }) => {
  const { t } = useTranslation('progress');
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {views.map((view) => {
        const Icon = view.icon;
        const title = t(`achievements.items.${view.id}.title`);
        const description = t(`achievements.items.${view.id}.description`);
        return (
          <li
            key={view.id}
            className={
              'flex flex-col gap-2 rounded-lg border p-4 transition-colors ' +
              (view.unlocked
                ? TIER_UNLOCKED_CLASS[view.tier]
                : 'border-border-base bg-surface text-fg-subtle opacity-70')
            }
            aria-label={t(view.unlocked ? 'achievements.unlockedAria' : 'achievements.lockedAria', {
              title,
            })}
          >
            <span
              className={
                'grid size-9 place-items-center rounded-full ' +
                (view.unlocked ? 'bg-surface/60 ring-1 ring-current/20' : 'bg-surface-2')
              }
            >
              <Icon size={18} className={view.unlocked ? '' : 'text-fg-subtle'} aria-hidden />
            </span>
            <div className="min-w-0">
              <p
                className={
                  'text-sm font-semibold leading-snug ' +
                  (view.unlocked ? 'text-fg' : 'text-fg-muted')
                }
              >
                {title}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-fg-subtle">{description}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

interface ProgressBarProps {
  passed: number;
  total: number;
}

const ProgressBar = ({ passed, total }: ProgressBarProps) => {
  const percent = total === 0 ? 0 : Math.round((passed / total) * 100);
  return (
    <div className="mt-3 h-1.5 rounded-full bg-surface-2 overflow-hidden">
      <div className="h-full bg-accent" style={{ width: `${percent}%` }} />
    </div>
  );
};
