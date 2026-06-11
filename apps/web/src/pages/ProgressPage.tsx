import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';

import type { TopicManifest } from '@dotlearn/contracts';
import { Link } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bookmark, Download, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { ActivityHeatmap } from '@/components/ActivityHeatmap';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { DualProgressBar } from '@/components/ui/DualProgressBar';
import { getCurrentLanguage } from '@/lib/i18n';
import { interviewQuestions } from '@/lib/interview';
import { computeMastery, countReadConcepts, useReadConceptsByTopic } from '@/lib/mastery';
import { db } from '@/lib/progress-db';
import {
  ProgressImportError,
  downloadProgressExport,
  exportProgress,
  importProgress,
} from '@/lib/progress-io';
import { effectiveLanguage, listManifests } from '@/lib/topics';
import { useBookmarks } from '@/lib/use-learning';
import { useInterviewStudiedIds } from '@/lib/use-interview';
import { useActivity, useStreak } from '@/lib/use-progress';
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

export const ProgressPage = () => {
  const { t } = useTranslation('progress');
  const formatRelative = useRelativeFormatter();
  const [manifests, setManifests] = useState<TopicManifest[] | undefined>(undefined);
  const activity = useActivity();
  const streak = useStreak();
  const progressRecords = useLiveQuery(() => db.progress.toArray(), [], []);
  const studiedIds = useInterviewStudiedIds();
  const bookmarks = useBookmarks();
  const readByTopic = useReadConceptsByTopic();

  useEffect(() => {
    let cancelled = false;
    listManifests().then((loaded) => {
      if (!cancelled) {
        setManifests(loaded);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const language = getCurrentLanguage();

  const rows = useMemo<TopicRow[]>(() => {
    if (!manifests) return [];
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
    if (!manifests) return [];
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

  const totalAttempted = useMemo(
    () => activity.reduce((sum, entry) => sum + entry.exercisesAttempted, 0),
    [activity],
  );
  const totalPassed = useMemo(
    () => (progressRecords ?? []).filter((record) => record.status === 'pass').length,
    [progressRecords],
  );
  const activeDays = activity.filter(
    (entry) => entry.exercisesAttempted > 0 || (entry.interviewStudied ?? 0) > 0,
  ).length;
  const interviewStudied = studiedIds.size;
  const interviewTotal = interviewQuestions.length;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleExport = async (): Promise<void> => {
    try {
      downloadProgressExport(await exportProgress());
      toast.success(t('data.exported'));
    } catch {
      toast.error(t('data.exportError'));
    }
  };

  const handleImportFile = async (
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
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

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label={t('stats.solved')} value={totalPassed} hint={t('stats.solvedHint')} />
        <StatTile
          label={t('stats.attempts')}
          value={totalAttempted}
          hint={t('stats.attemptsHint')}
        />
        <StatTile
          label={t('stats.activeDays')}
          value={activeDays}
          hint={t('stats.activeDaysHint')}
        />
        <StatTile label={t('stats.streak')} value={streak} hint={t('stats.streakHint')} emphasis />
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
        <h2 className="eyebrow border-b border-border-base pb-2">
          {t('interview.heading')}
        </h2>
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
        {manifests === undefined ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1].map((index) => (
              <div
                key={index}
                className="h-28 rounded-lg border border-border-base bg-surface-2 animate-pulse"
                aria-hidden
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-fg-subtle">{t('noTopics')}</p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rows.map((row) => {
              const totalConcepts = row.manifest.concepts.length;
              const m = computeMastery(row.readConcepts, totalConcepts, row.passed, row.total);
              const masteryPercent = Math.round(m.mastery * 100);
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
          <p className="text-sm text-fg-muted max-w-prose">{t('data.hint')}</p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void handleExport()}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-md border border-border-strong px-3 min-h-[var(--tap)] text-sm text-fg hover:bg-surface-2 transition-colors"
            >
              <Download size={15} />
              {t('data.export')}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-md border border-border-strong px-3 min-h-[var(--tap)] text-sm text-fg hover:bg-surface-2 transition-colors"
            >
              <Upload size={15} />
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
