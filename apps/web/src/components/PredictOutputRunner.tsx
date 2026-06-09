import { useState } from 'react';

import type { PredictOutputExercise } from '@dotlearn/contracts';
import { runPredictOutput } from '@dotlearn/lesson-engine';
import { toast } from 'sonner';

import { recordAttempt } from '@/lib/progress-db';

interface PredictOutputRunnerProps {
  topicSlug: string;
  exercise: PredictOutputExercise;
}

type CheckState =
  | { kind: 'idle' }
  | { kind: 'pass' }
  | { kind: 'fail'; reason: string; expected?: unknown; actual?: unknown };

const parseScalar = (raw: string): unknown => {
  const trimmed = raw.trim();
  if (trimmed === '') return '';
  if (trimmed === 'null') return null;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
  if (/^-?\d+\.\d+$/.test(trimmed)) return Number(trimmed);
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

export const PredictOutputRunner = ({ topicSlug, exercise }: PredictOutputRunnerProps) => {
  const [draft, setDraft] = useState('');
  const [state, setState] = useState<CheckState>({ kind: 'idle' });

  const handleCheck = () => {
    const value =
      exercise.expected.kind === 'scalar'
        ? parseScalar(draft)
        : exercise.expected.kind === 'stdout'
          ? draft
          : draft;
    const result = runPredictOutput(exercise, value);
    if (result.ok) {
      setState({ kind: 'pass' });
      toast.success('Correct prediction', { description: exercise.id });
      void recordAttempt(topicSlug, exercise.id, 'pass');
    } else {
      const details = (result.details ?? {}) as { expected?: unknown; actual?: unknown };
      setState({
        kind: 'fail',
        reason: result.reason,
        ...(details.expected !== undefined ? { expected: details.expected } : {}),
        ...(details.actual !== undefined ? { actual: details.actual } : {}),
      });
      void recordAttempt(topicSlug, exercise.id, 'fail');
    }
  };

  const inputHint =
    exercise.expected.kind === 'scalar'
      ? 'enter a value (number, "string", true/false, null)'
      : exercise.expected.kind === 'stdout'
        ? 'enter the printed text exactly as it would appear'
        : 'enter JSON array of row objects';

  return (
    <div className="space-y-3">
      <pre className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3 text-xs font-mono overflow-x-auto whitespace-pre">
        {exercise.snippet}
      </pre>
      {exercise.expected.kind === 'stdout' ? (
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={inputHint}
          rows={3}
          className="w-full rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/60"
        />
      ) : (
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={inputHint}
          className="w-full rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm font-mono text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/60"
        />
      )}

      <button
        type="button"
        onClick={handleCheck}
        disabled={draft.trim().length === 0}
        className="rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Check prediction
      </button>

      {exercise.hints && exercise.hints.length > 0 && (
        <details className="text-xs text-zinc-400">
          <summary className="cursor-pointer hover:text-zinc-200">Hints</summary>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            {exercise.hints.map((hint, index) => (
              <li key={index}>{hint}</li>
            ))}
          </ul>
        </details>
      )}

      {state.kind === 'pass' && (
        <div className="rounded-md border border-emerald-900/40 bg-emerald-950/30 p-3 text-sm text-emerald-200">
          Correct.
        </div>
      )}

      {state.kind === 'fail' && (
        <div className="rounded-md border border-rose-900/40 bg-rose-950/30 p-3 text-sm text-rose-200 space-y-1">
          <p className="font-medium">Not quite — {state.reason}.</p>
          {state.expected !== undefined && (
            <p className="text-xs text-rose-100/80">
              expected: <code>{JSON.stringify(state.expected)}</code>
            </p>
          )}
          {state.actual !== undefined && (
            <p className="text-xs text-rose-100/80">
              got: <code>{JSON.stringify(state.actual)}</code>
            </p>
          )}
        </div>
      )}
    </div>
  );
};
