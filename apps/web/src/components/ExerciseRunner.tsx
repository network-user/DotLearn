import type { Exercise } from '@dotlearn/contracts';

import { useExerciseStatus } from '@/lib/use-progress';

import { FillInBlanksRunner } from './FillInBlanksRunner';
import { PredictOutputRunner } from './PredictOutputRunner';
import { SqlExerciseRunner } from './SqlExerciseRunner';
import { TheoryQuizRunner } from './TheoryQuizRunner';

interface ExerciseRunnerProps {
  topicSlug: string;
  exercise: Exercise;
}

const STATUS_BADGE: Record<string, string> = {
  pass: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
  fail: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
};

const STATUS_LABEL: Record<string, string> = {
  pass: 'solved',
  fail: 'attempted',
};

const DIFFICULTY_LABEL: Record<number, string> = {
  1: 'easy',
  2: 'easy+',
  3: 'medium',
  4: 'hard',
  5: 'hard+',
};

export const ExerciseRunner = ({ topicSlug, exercise }: ExerciseRunnerProps) => {
  const status = useExerciseStatus(topicSlug, exercise.id);
  return (
    <article className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500 font-medium">
            <span>{exercise.type}</span>
            {status && (
              <span
                className={`rounded border px-1.5 py-0.5 text-[10px] tracking-wide ${
                  STATUS_BADGE[status] ?? ''
                }`}
              >
                {STATUS_LABEL[status]}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-zinc-200 whitespace-pre-wrap">{exercise.prompt}</p>
        </div>
        <span className="text-[10px] uppercase tracking-wide text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded shrink-0">
          {DIFFICULTY_LABEL[exercise.difficulty] ?? `lv ${exercise.difficulty}`}
        </span>
      </header>
      <Body topicSlug={topicSlug} exercise={exercise} />
    </article>
  );
};

const Body = ({ topicSlug, exercise }: ExerciseRunnerProps) => {
  if (exercise.type === 'sql-query') {
    return <SqlExerciseRunner topicSlug={topicSlug} exercise={exercise} />;
  }
  if (exercise.type === 'theory-quiz') {
    return <TheoryQuizRunner topicSlug={topicSlug} exercise={exercise} />;
  }
  if (exercise.type === 'predict-output') {
    return <PredictOutputRunner topicSlug={topicSlug} exercise={exercise} />;
  }
  if (exercise.type === 'fill-in-blanks') {
    return <FillInBlanksRunner topicSlug={topicSlug} exercise={exercise} />;
  }
  return (
    <p className="text-sm text-zinc-500 italic">
      Interactive runner for <code>{exercise.type}</code> is not implemented yet.
    </p>
  );
};
