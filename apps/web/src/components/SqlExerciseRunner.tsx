import { useCallback, useState } from 'react';

import type { SqlQueryExercise } from '@dotlearn/contracts';
import { runSqlQuery } from '@dotlearn/lesson-engine';
import Editor from '@monaco-editor/react';
import { toast } from 'sonner';

import { recordAttempt } from '@/lib/progress-db';
import { getSqlRuntime } from '@/lib/sql-runtime';

import { ResultTable } from './ResultTable';

interface SqlExerciseRunnerProps {
  topicSlug: string;
  exercise: SqlQueryExercise;
}

type RunState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'pass'; columns: string[]; rows: Record<string, unknown>[] }
  | {
      kind: 'fail';
      reason: string;
      missing?: Record<string, unknown>[];
      extra?: Record<string, unknown>[];
      misordered?: boolean;
    }
  | { kind: 'error'; message: string };

const INITIAL_ANSWER = '-- write your query here\n';

export const SqlExerciseRunner = ({ topicSlug, exercise }: SqlExerciseRunnerProps) => {
  const [answer, setAnswer] = useState<string>(INITIAL_ANSWER);
  const [state, setState] = useState<RunState>({ kind: 'idle' });
  const [hintsOpen, setHintsOpen] = useState(false);

  const handleRun = useCallback(async () => {
    setState({ kind: 'running' });
    try {
      const runtime = getSqlRuntime();
      const result = await runSqlQuery(exercise, answer, runtime);
      if (result.ok) {
        const details = (result.details ?? {}) as {
          columns?: string[];
          rows?: Record<string, unknown>[];
        };
        setState({
          kind: 'pass',
          columns: details.columns ?? [],
          rows: details.rows ?? [],
        });
        toast.success('Correct query', { description: exercise.id });
        void recordAttempt(topicSlug, exercise.id, 'pass');
      } else {
        const details = (result.details ?? {}) as {
          missing?: Record<string, unknown>[];
          extra?: Record<string, unknown>[];
          misordered?: boolean;
        };
        setState({
          kind: 'fail',
          reason: result.reason,
          ...(details.missing !== undefined ? { missing: details.missing } : {}),
          ...(details.extra !== undefined ? { extra: details.extra } : {}),
          ...(details.misordered !== undefined ? { misordered: details.misordered } : {}),
        });
        void recordAttempt(topicSlug, exercise.id, 'fail');
      }
    } catch (error) {
      setState({
        kind: 'error',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, [answer, exercise, topicSlug]);

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
        <Editor
          value={answer}
          onChange={(value) => setAnswer(value ?? '')}
          language="sql"
          theme="vs-dark"
          height="180px"
          options={{
            fontSize: 13,
            minimap: { enabled: false },
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            tabSize: 2,
          }}
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleRun}
          disabled={state.kind === 'running'}
          className="rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {state.kind === 'running' ? 'Running…' : 'Run query'}
        </button>
        {exercise.hints && exercise.hints.length > 0 && (
          <button
            type="button"
            onClick={() => setHintsOpen((open) => !open)}
            className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
          >
            {hintsOpen ? 'Hide hints' : `Show hints (${exercise.hints.length})`}
          </button>
        )}
      </div>

      {hintsOpen && exercise.hints && (
        <ul className="rounded-md border border-zinc-800 bg-zinc-900/40 p-3 text-sm text-zinc-300 space-y-1 list-disc pl-6">
          {exercise.hints.map((hint, index) => (
            <li key={index}>{hint}</li>
          ))}
        </ul>
      )}

      <RunStateView state={state} />
    </div>
  );
};

const RunStateView = ({ state }: { state: RunState }) => {
  if (state.kind === 'idle' || state.kind === 'running') {
    return null;
  }
  if (state.kind === 'error') {
    return (
      <div className="rounded-md border border-amber-900/40 bg-amber-950/30 p-3 text-sm text-amber-200">
        Runtime error: {state.message}
      </div>
    );
  }
  if (state.kind === 'pass') {
    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-emerald-300">
          Pass — your query produced the expected rows.
        </p>
        <ResultTable columns={state.columns} rows={state.rows} />
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-rose-300">Fail — {state.reason}</p>
      {state.missing && state.missing.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">Missing rows</p>
          <ResultTable
            columns={Object.keys(state.missing[0] ?? {})}
            rows={state.missing}
            emptyMessage="—"
          />
        </div>
      )}
      {state.extra && state.extra.length > 0 && (
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500 mb-1">Unexpected rows</p>
          <ResultTable
            columns={Object.keys(state.extra[0] ?? {})}
            rows={state.extra}
            emptyMessage="—"
          />
        </div>
      )}
      {state.misordered && (
        <p className="text-sm text-amber-300">Hint: rows match but the order differs.</p>
      )}
    </div>
  );
};
