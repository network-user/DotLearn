import { useEffect, useMemo, useState } from 'react';

import type { TopicManifest } from '@dotlearn/contracts';
import type { TopicBundle } from '@dotlearn/lesson-engine';
import { Link } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';

import { db } from '@/lib/progress-db';
import { listManifests, loadTopic } from '@/lib/topics';

interface TopicRow {
  manifest: TopicManifest;
  total: number;
  passed: number;
}

const DIFFICULTY_TINT: Record<string, string> = {
  beginner: 'text-emerald-300 border-emerald-500/30',
  intermediate: 'text-amber-300 border-amber-500/30',
  advanced: 'text-rose-300 border-rose-500/30',
};

export const HomePage = () => {
  const [bundles, setBundles] = useState<TopicBundle[] | undefined>(undefined);
  const progressRecords = useLiveQuery(() => db.progress.toArray(), [], []);

  useEffect(() => {
    let cancelled = false;
    listManifests()
      .then((manifests) => Promise.all(manifests.map((manifest) => loadTopic(manifest.slug))))
      .then((loaded) => {
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
    const passedByTopic = new Map<string, number>();
    for (const record of progressRecords ?? []) {
      if (record.status === 'pass') {
        passedByTopic.set(record.topicSlug, (passedByTopic.get(record.topicSlug) ?? 0) + 1);
      }
    }
    return bundles.map((bundle) => ({
      manifest: bundle.manifest,
      total: bundle.concepts.reduce(
        (sum, concept) => sum + concept.exercises.reduce((s, file) => s + file.exercises.length, 0),
        0,
      ),
      passed: passedByTopic.get(bundle.manifest.slug) ?? 0,
    }));
  }, [bundles, progressRecords]);

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-3xl font-semibold tracking-tight">Your learning workbench</h1>
        <p className="mt-3 text-zinc-400 max-w-2xl">
          DotLearn is a local-first platform where each topic is a self-contained, type-safe module.
          Generate new topics with the <code className="text-indigo-300">lesson-forge</code> skill,
          study them in the browser, fork the repo and ask your own agent for a personal
          curriculum.
        </p>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-xl font-semibold">Topics</h2>
          <span className="text-sm text-zinc-500">
            {bundles === undefined ? 'loading…' : `${rows.length} available`}
          </span>
        </div>
        {bundles === undefined ? (
          <SkeletonGrid />
        ) : rows.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {rows.map((row) => (
              <li key={row.manifest.slug}>
                <TopicCard row={row} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

interface TopicCardProps {
  row: TopicRow;
}

const TopicCard = ({ row }: TopicCardProps) => {
  const { manifest, total, passed } = row;
  const percent = total === 0 ? 0 : Math.round((passed / total) * 100);
  return (
    <Link
      to="/topics/$slug"
      params={{ slug: manifest.slug }}
      className="group block rounded-xl border border-zinc-800 bg-zinc-900/60 hover:border-indigo-500/50 hover:bg-zinc-900 transition p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-zinc-100 group-hover:text-white truncate">
            {manifest.title}
          </h3>
          <p className="mt-1 text-xs text-zinc-500">
            {manifest.concepts.length} concepts · ~{manifest.estimatedHours}h · {manifest.runtime}
          </p>
        </div>
        <span
          className={`shrink-0 text-[10px] uppercase tracking-wide border rounded px-1.5 py-0.5 ${
            DIFFICULTY_TINT[manifest.difficulty] ?? 'text-zinc-400 border-zinc-700'
          }`}
        >
          {manifest.difficulty}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="text-xs text-zinc-400 tabular-nums">
          {passed}/{total}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {manifest.tags.map((tag) => (
          <span
            key={tag}
            className="text-[10px] uppercase tracking-wide text-zinc-400 bg-zinc-800/80 px-1.5 py-0.5 rounded"
          >
            {tag}
          </span>
        ))}
      </div>
    </Link>
  );
};

const SkeletonGrid = () => (
  <ul className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-hidden>
    {[0, 1].map((index) => (
      <li
        key={index}
        className="h-36 rounded-xl border border-zinc-800 bg-zinc-900/40 animate-pulse"
      />
    ))}
  </ul>
);

const EmptyState = () => (
  <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center">
    <h3 className="font-medium text-zinc-200">No topics yet</h3>
    <p className="mt-1 text-sm text-zinc-400">
      Ask your agent in this repo:{' '}
      <span className="text-indigo-300">«Use lesson-forge, add a topic on SQL»</span>.
    </p>
  </div>
);

