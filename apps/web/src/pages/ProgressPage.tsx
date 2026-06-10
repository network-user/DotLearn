import { useEffect, useMemo, useState } from 'react';

import type { TopicManifest } from '@dotlearn/contracts';
import { Link } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { useTranslation } from 'react-i18next';

import { ActivityHeatmap } from '@/components/ActivityHeatmap';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { getCurrentLanguage } from '@/lib/i18n';
import { interviewQuestions } from '@/lib/interview';
import { db } from '@/lib/progress-db';
import { effectiveLanguage, listManifests } from '@/lib/topics';
import { useInterviewStudiedIds } from '@/lib/use-interview';
import { useActivity, useStreak } from '@/lib/use-progress';
import topicStats from 'virtual:topic-stats';

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
  const { t } = useTranslation('progress');
  const formatRelative = useRelativeFormatter();
  const [manifests, setManifests] = useState<TopicManifest[] | undefined>(undefined);
  const activity = useActivity();
  const streak = useStreak();
  const progressRecords = useLiveQuery(() => db.progress.toArray(), [], []);
  const studiedIds = useInterviewStudiedIds();

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
        lastAttemptAt: stats.lastAttemptAt,
      };
    });
  }, [manifests, progressRecords, language]);

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

      <section className="space-y-3">
        <h2 className="eyebrow border-b border-border-base pb-2">{t('topics')}</h2>
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
            {rows.map((row) => (
              <li key={row.manifest.slug}>
                <Link
                  to="/topics/$slug"
                  params={{ slug: row.manifest.slug }}
                  className="block rounded-lg border border-border-base bg-surface hover:border-border-strong hover:bg-surface-2/50 transition p-5"
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
