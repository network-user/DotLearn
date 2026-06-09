import { useEffect, useMemo, useState } from 'react';

import type { TopicManifest } from '@dotlearn/contracts';
import type { TopicBundle } from '@dotlearn/lesson-engine';
import { Link } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';

import { ActivityHeatmap } from '@/components/ActivityHeatmap';
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

const formatRelative = (iso: string | undefined): string => {
  if (!iso) {
    return 'no attempts yet';
  }
  const now = Date.now();
  const past = new Date(iso).getTime();
  const seconds = Math.max(1, Math.floor((now - past) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
};

export const ProgressPage = () => {
  const [bundles, setBundles] = useState<TopicBundle[] | undefined>(undefined);
  const activity = useActivity();
  const streak = useStreak();
  const progressRecords = useLiveQuery(() => db.progress.toArray(), [], []);

  useEffect(() => {
    let cancelled = false;
    listManifests().then(async (manifests) => {
      const loaded = await Promise.all(manifests.map((manifest) => loadTopic(manifest.slug)));
      if (!cancelled) {
        setBundles(loaded);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
        <h1 className="text-3xl font-semibold tracking-tight">Your progress</h1>
        <p className="mt-2 text-sm text-zinc-400 max-w-2xl">
          All metrics live in your browser (IndexedDB) and never leave the device.
        </p>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Solved" value={totalPassed} hint="unique exercises" />
        <StatTile label="Attempts" value={totalAttempted} hint="total runs" />
        <StatTile label="Active days" value={activeDays} hint="last 90d window" />
        <StatTile label="Streak" value={streak} hint="consecutive days" emphasis />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Activity</h2>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <ActivityHeatmap activity={activity} weeks={14} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Topics</h2>
        {bundles === undefined ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[0, 1].map((index) => (
              <div
                key={index}
                className="h-28 rounded-xl border border-zinc-800 bg-zinc-900/40 animate-pulse"
                aria-hidden
              />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-zinc-500">No topics yet.</p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rows.map((row) => (
              <li key={row.manifest.slug}>
                <Link
                  to="/topics/$slug"
                  params={{ slug: row.manifest.slug }}
                  className="block rounded-xl border border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-900 transition p-5"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-zinc-100">{row.manifest.title}</h3>
                    <span className="text-xs text-zinc-500 tabular-nums">
                      {row.passed}/{row.total}
                    </span>
                  </div>
                  <ProgressBar passed={row.passed} total={row.total} />
                  <p className="mt-2 text-xs text-zinc-500">
                    Last attempt: {formatRelative(row.lastAttemptAt)} · {row.failed} failure
                    {row.failed === 1 ? '' : 's'}
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
        : 'border-zinc-800 bg-zinc-900/40')
    }
  >
    <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
    <p className="mt-1 text-3xl font-semibold text-zinc-100 tabular-nums">{value}</p>
    <p className="mt-1 text-[11px] text-zinc-500">{hint}</p>
  </div>
);

interface ProgressBarProps {
  passed: number;
  total: number;
}

const ProgressBar = ({ passed, total }: ProgressBarProps) => {
  const percent = total === 0 ? 0 : Math.round((passed / total) * 100);
  return (
    <div className="mt-3 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
};
