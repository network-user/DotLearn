import { useEffect, useMemo, useState } from 'react';

import type { Exercise } from '@dotlearn/contracts';
import type { TopicBundle } from '@dotlearn/lesson-engine';
import { Link, useParams } from '@tanstack/react-router';

import { ExerciseRunner } from '@/components/ExerciseRunner';
import { TheoryContent } from '@/components/TheoryContent';
import { getTheory } from '@/lib/theory';
import { loadTopic } from '@/lib/topics';
import { useStreak, useTopicProgress } from '@/lib/use-progress';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; bundle: TopicBundle }
  | { kind: 'error'; message: string };

export const TopicPage = () => {
  const { slug } = useParams({ from: '/topics/$slug' });
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [activeConceptId, setActiveConceptId] = useState<string | undefined>(undefined);
  const progress = useTopicProgress(slug);
  const streak = useStreak();

  useEffect(() => {
    let cancelled = false;
    setState({ kind: 'loading' });
    loadTopic(slug)
      .then((bundle) => {
        if (cancelled) return;
        setState({ kind: 'ready', bundle });
        setActiveConceptId(bundle.manifest.concepts[0]?.id);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          kind: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (state.kind === 'loading') {
    return <TopicSkeleton />;
  }

  if (state.kind === 'error') {
    return (
      <div className="rounded-xl border border-rose-900/40 bg-rose-950/30 p-8">
        <h2 className="font-semibold text-rose-100">Failed to load topic</h2>
        <p className="mt-2 text-sm text-rose-300">{state.message}</p>
        <Link to="/" className="inline-block mt-4 text-indigo-300 hover:text-indigo-200">
          Back to home
        </Link>
      </div>
    );
  }

  const { bundle } = state;
  const { manifest } = bundle;
  const activeConcept =
    bundle.concepts.find((concept) => concept.conceptId === activeConceptId) ?? bundle.concepts[0];
  const activeManifestConcept = manifest.concepts.find(
    (concept) => concept.id === activeConcept?.conceptId,
  );

  const totalExercises = bundle.concepts.reduce(
    (sum, concept) => sum + concept.exercises.reduce((s, file) => s + file.exercises.length, 0),
    0,
  );

  return (
    <div className="space-y-6">
      <TopicHeader
        manifest={manifest}
        passed={progress.passed}
        totalExercises={totalExercises}
        streak={streak}
      />
      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-8">
        <ConceptRail
          bundle={bundle}
          activeConceptId={activeConcept?.conceptId}
          onSelect={setActiveConceptId}
          progress={progress.byExercise}
        />
        <section className="min-w-0">
          {activeConcept && activeManifestConcept ? (
            <ConceptPanel
              slug={slug}
              theoryFiles={activeManifestConcept.theoryFiles}
              exercises={activeConcept.exercises.flatMap((file) => file.exercises)}
            />
          ) : (
            <p className="text-zinc-500">No concepts in this topic.</p>
          )}
        </section>
      </div>
    </div>
  );
};

interface TopicHeaderProps {
  manifest: TopicBundle['manifest'];
  passed: number;
  totalExercises: number;
  streak: number;
}

const TopicHeader = ({ manifest, passed, totalExercises, streak }: TopicHeaderProps) => {
  const ratio = totalExercises === 0 ? 0 : passed / totalExercises;
  const percent = Math.round(ratio * 100);
  return (
    <header className="space-y-3">
      <div className="flex items-center gap-2 text-xs text-zinc-500 uppercase tracking-wide">
        <span>{manifest.difficulty}</span>
        <span>·</span>
        <span>{manifest.runtime}</span>
        <span>·</span>
        <span>~{manifest.estimatedHours}h</span>
        {streak > 0 && (
          <>
            <span>·</span>
            <span className="text-amber-300">streak {streak}d</span>
          </>
        )}
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">{manifest.title}</h1>
      <div className="flex flex-wrap gap-1">
        {manifest.tags.map((tag) => (
          <span
            key={tag}
            className="text-[10px] uppercase tracking-wide text-zinc-400 bg-zinc-800/80 px-1.5 py-0.5 rounded"
          >
            {tag}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-3 max-w-md">
        <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="text-xs text-zinc-400 tabular-nums">
          {passed}/{totalExercises} solved
        </span>
      </div>
    </header>
  );
};

interface ConceptRailProps {
  bundle: TopicBundle;
  activeConceptId: string | undefined;
  onSelect: (conceptId: string) => void;
  progress: Map<string, import('@/lib/progress-db').ProgressRecord>;
}

const ConceptRail = ({ bundle, activeConceptId, onSelect, progress }: ConceptRailProps) => (
  <aside className="lg:sticky lg:top-20 self-start">
    <nav className="rounded-xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
      <ol>
        {bundle.manifest.concepts.map((concept, index) => {
          const active = concept.id === activeConceptId;
          const conceptBundle = bundle.concepts.find((entry) => entry.conceptId === concept.id);
          const exercises = conceptBundle?.exercises.flatMap((file) => file.exercises) ?? [];
          const passed = exercises.filter(
            (exercise) => progress.get(exercise.id)?.status === 'pass',
          ).length;
          return (
            <li key={concept.id}>
              <button
                type="button"
                onClick={() => onSelect(concept.id)}
                className={
                  'w-full text-left px-4 py-3 border-b border-zinc-800/60 last:border-b-0 transition ' +
                  (active
                    ? 'bg-indigo-500/10 text-indigo-100'
                    : 'text-zinc-300 hover:bg-zinc-900')
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {index + 1}. {concept.title}
                  </span>
                  <span className="text-xs text-zinc-500">{concept.estimatedMinutes}m</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <ExerciseDots exercises={exercises} progress={progress} />
                  <span className="text-xs text-zinc-500 tabular-nums">
                    {passed}/{exercises.length}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  </aside>
);

interface ExerciseDotsProps {
  exercises: Exercise[];
  progress: Map<string, import('@/lib/progress-db').ProgressRecord>;
}

const ExerciseDots = ({ exercises, progress }: ExerciseDotsProps) => (
  <div className="flex flex-wrap gap-1">
    {exercises.map((exercise) => {
      const status = progress.get(exercise.id)?.status;
      const className =
        status === 'pass'
          ? 'bg-emerald-400'
          : status === 'fail'
            ? 'bg-rose-400'
            : 'bg-zinc-700';
      return (
        <span
          key={exercise.id}
          className={`size-2 rounded-full ${className}`}
          title={`${exercise.id} — ${status ?? 'not attempted'}`}
        />
      );
    })}
  </div>
);

interface ConceptPanelProps {
  slug: string;
  theoryFiles: string[];
  exercises: Exercise[];
}

const ConceptPanel = ({ slug, theoryFiles, exercises }: ConceptPanelProps) => {
  const theories = useMemo(
    () => theoryFiles.map((filename) => ({ filename, resolved: getTheory(slug, filename) })),
    [slug, theoryFiles],
  );

  return (
    <article className="space-y-10">
      {theories.map(({ filename, resolved }) => (
        <section
          key={filename}
          className="rounded-xl border border-zinc-800 bg-zinc-900/30 px-6 py-5"
        >
          {resolved ? (
            <TheoryContent Component={resolved.Component} />
          ) : (
            <p className="text-rose-300 text-sm">Theory file {filename} could not be loaded.</p>
          )}
        </section>
      ))}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-zinc-200 uppercase tracking-wide">
          Exercises ({exercises.length})
        </h3>
        {exercises.length === 0 ? (
          <p className="text-sm text-zinc-500 italic">No exercises for this concept yet.</p>
        ) : (
          <div className="space-y-4">
            {exercises.map((exercise) => (
              <ExerciseRunner key={exercise.id} topicSlug={slug} exercise={exercise} />
            ))}
          </div>
        )}
      </section>
    </article>
  );
};

const TopicSkeleton = () => (
  <div className="space-y-6" aria-hidden>
    <div className="h-8 w-64 rounded bg-zinc-800 animate-pulse" />
    <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-8">
      <div className="h-64 rounded-xl bg-zinc-900/40 animate-pulse" />
      <div className="h-96 rounded-xl bg-zinc-900/40 animate-pulse" />
    </div>
  </div>
);
