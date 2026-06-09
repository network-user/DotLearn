import { useState } from 'react';

import type { TheoryQuizExercise } from '@dotlearn/contracts';
import { runTheoryQuiz } from '@dotlearn/lesson-engine';

import { recordAttempt } from '@/lib/progress-db';

interface TheoryQuizRunnerProps {
  topicSlug: string;
  exercise: TheoryQuizExercise;
}

type CheckState =
  | { kind: 'idle' }
  | { kind: 'pass'; explanation?: string }
  | {
      kind: 'fail';
      reason: string;
      missing?: string[];
      unexpected?: string[];
      explanation?: string;
    };

export const TheoryQuizRunner = ({ topicSlug, exercise }: TheoryQuizRunnerProps) => {
  const allowMultiple = exercise.correct.length > 1;
  const [selected, setSelected] = useState<string[]>([]);
  const [state, setState] = useState<CheckState>({ kind: 'idle' });

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (allowMultiple) {
        return prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id];
      }
      return [id];
    });
    setState({ kind: 'idle' });
  };

  const handleCheck = () => {
    const result = runTheoryQuiz(exercise, selected);
    if (result.ok) {
      const details = (result.details ?? {}) as { explanation?: string };
      setState({
        kind: 'pass',
        ...(details.explanation !== undefined ? { explanation: details.explanation } : {}),
      });
      void recordAttempt(topicSlug, exercise.id, 'pass');
    } else {
      const details = (result.details ?? {}) as {
        missing?: string[];
        unexpected?: string[];
        explanation?: string;
      };
      setState({
        kind: 'fail',
        reason: result.reason,
        ...(details.missing !== undefined ? { missing: details.missing } : {}),
        ...(details.unexpected !== undefined ? { unexpected: details.unexpected } : {}),
        ...(details.explanation !== undefined ? { explanation: details.explanation } : {}),
      });
      void recordAttempt(topicSlug, exercise.id, 'fail');
    }
  };

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {exercise.choices.map((choice) => {
          const checked = selected.includes(choice.id);
          return (
            <li key={choice.id}>
              <label
                className={
                  'flex items-start gap-3 rounded-md border px-3 py-2 cursor-pointer transition ' +
                  (checked
                    ? 'border-indigo-500/60 bg-indigo-500/10'
                    : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700')
                }
              >
                <input
                  type={allowMultiple ? 'checkbox' : 'radio'}
                  name={`quiz-${exercise.id}`}
                  checked={checked}
                  onChange={() => toggle(choice.id)}
                  className="mt-1 accent-indigo-500"
                />
                <span className="text-sm text-zinc-200">{choice.text}</span>
              </label>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={handleCheck}
        disabled={selected.length === 0}
        className="rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Check answer
      </button>

      {state.kind === 'pass' && (
        <div className="rounded-md border border-emerald-900/40 bg-emerald-950/30 p-3 text-sm text-emerald-200">
          <p className="font-medium">Correct.</p>
          {state.explanation && <p className="mt-1 text-emerald-100/80">{state.explanation}</p>}
        </div>
      )}

      {state.kind === 'fail' && (
        <div className="rounded-md border border-rose-900/40 bg-rose-950/30 p-3 text-sm text-rose-200 space-y-1">
          <p className="font-medium">Not quite — {state.reason}.</p>
          {state.explanation && <p className="text-rose-100/80">{state.explanation}</p>}
        </div>
      )}
    </div>
  );
};
