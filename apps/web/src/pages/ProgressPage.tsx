import { useEffect, useMemo, useState } from 'react';

import type { TopicManifest } from '@dotlearn/contracts';
import type { TopicBundle } from '@dotlearn/lesson-engine';
import { Link } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';

import { ActivityHeatmap } from '@/components/ActivityHeatmap';
import { getCurrentLanguage } from '@/lib/i18n';
import { db } from '@/lib/progress-db';
import { listManifests, loadTopic } from '@/lib/topics';
import { useActivity, useStreak } from '@/lib/use-progress';

interface TopicRow {
  manifest: TopicManifest;
  total: number;
  passed: number;
  failed: number;
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
  const { t, i18n } = useTranslation('progress');
  const formatRelative = useRelativeFormatter();
  const [bundles, setBundles] = useState<TopicBundle[] | undefined>(undefined);
  const activity = useActivity();
  const streak = useStreak();
  const progressRecords = useLiveQuery(() => db.progress.toArray(), [], []);

  useEffect(() => {
    let cancelled = false;
    const language = getCurrentLanguage();
    listManifests().then(async (manifests) => {
      const loaded = await Promise.all(
        manifests.map((manifest) => loadTopic(manifest.slug, language)),
      );
      if (!cancelled) {
        setBundles(loaded);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [i18n.resolvedLanguage]);

  const rows = useMemo<TopicRow[]>(() => {
    if (!bundles) return [];
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
    return bundles.map((bundle) => {
      const total = bundle.concepts.reduce(
        (sum, concept) => sum + concept.exercises.reduce((s, file) => s + file.exercises.length, 0),
        0,
      );
      const stats = byTopic.get(bundle.manifest.slug) ?? { passed: 0, failed: 0 };
      return {
        manifest: bundle.manifest,
        total,
        passed: stats.passed,
        failed: stats.failed,
        lastAttemptAt: stats.lastAttemptAt,
      };
    });
  }, [bundles, progressRecords]);

  const totalAttempted = useMemo(
    () => activity.reduce((sum, entry) => sum + entry.exercisesAttempted, 0),
    [activity],
  );
  const totalPassed = useMemo(
    () => (progressRecords ?? []).filter((record) => record.status === 'pass').length,
    [progressRecords],
  );
  const activeDays = activity.filter((entry) => entry.exercisesAttempted > 0).length;

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
        <h2 className="text-lg font-semibold">{t('activity')}</h2>
        <div className="rounded-xl border border-border-base bg-surface/40 p-5">
          <ActivityHeatmap activity={activity} weeks={14} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t('topics')}</h2>
        {bundles === undefined ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1].map((index) => (
              <div
                key={index}
                className="h-28 rounded-xl border border-border-base bg-surface/40 animate-pulse"
                aria-hidden
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-fg-subtle">{t('noTopics')}</p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rows.map((row) => (
              <li key={row.manifest.slug}>
                <Link
                  to="/topics/$slug"
                  params={{ slug: row.manifest.slug }}
                  className="block rounded-xl border border-border-base bg-surface/60 hover:border-border-strong hover:bg-surface transition p-5"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-fg">{row.manifest.title}</h3>
                    <span className="text-xs text-fg-subtle tabular-nums">
                      {row.passed}/{row.total}
                    </span>
                  </div>
                  <ProgressBar passed={row.passed} total={row.total} />
                  <p className="mt-2 text-xs text-fg-subtle">
                    {t('lastAttempt', {
                      when: formatRelative(row.lastAttemptAt),
                      count: row.failed,
                    })}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
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
      'rounded-xl border p-4 ' +
      (emphasis
        ? 'border-amber-500/30 bg-amber-500/5'
        : 'border-border-base bg-surface/40')
    }
  >
    <p className="text-xs uppercase tracking-wide text-fg-subtle">{label}</p>
    <p className="mt-1 text-3xl font-semibold text-fg tabular-nums">{value}</p>
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
      <div
        className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
};
