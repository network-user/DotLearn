import { Fragment, useMemo, useState } from 'react';

import type { FillInBlanksExercise } from '@dotlearn/contracts';
import { runFillInBlanks } from '@dotlearn/lesson-engine';
import { toast } from 'sonner';

import { recordAttempt } from '@/lib/progress-db';

interface FillInBlanksRunnerProps {
  topicSlug: string;
  exercise: FillInBlanksExercise;
}

interface Segment {
  kind: 'text' | 'blank';
  value: string;
}

const splitTemplate = (template: string): Segment[] => {
  const parts: Segment[] = [];
  const regex = /\{\{([a-zA-Z0-9_-]+)\}\}/g;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(template)) !== null) {
    if (match.index > cursor) {
      parts.push({ kind: 'text', value: template.slice(cursor, match.index) });
    }
    parts.push({ kind: 'blank', value: match[1] as string });
    cursor = match.index + match[0].length;
  }
  if (cursor < template.length) {
    parts.push({ kind: 'text', value: template.slice(cursor) });
  }
  return parts;
};

type CheckState =
  | { kind: 'idle' }
  | { kind: 'pass' }
  | { kind: 'fail'; failures: Array<{ blank: string; reason: string; got: string | undefined }> };

export const FillInBlanksRunner = ({ topicSlug, exercise }: FillInBlanksRunnerProps) => {
  const segments = useMemo(() => splitTemplate(exercise.template), [exercise.template]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [state, setState] = useState<CheckState>({ kind: 'idle' });

  const update = (blank: string, value: string): void => {
    setValues((prev) => ({ ...prev, [blank]: value }));
  };

  const handleCheck = (): void => {
    const result = runFillInBlanks(exercise, values);
    if (result.ok) {
      setState({ kind: 'pass' });
      toast.success('All blanks correct', { description: exercise.id });
      void recordAttempt(topicSlug, exercise.id, 'pass');
    } else {
      const details = (result.details ?? {}) as {
        failures?: Array<{ blank: string; reason: string; got: string | undefined }>;
      };
      setState({ kind: 'fail', failures: details.failures ?? [] });
      void recordAttempt(topicSlug, exercise.id, 'fail');
    }
  };

  return (
    <div className="space-y-3">
      <pre className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-3 text-xs font-mono overflow-x-auto whitespace-pre">
        {segments.map((segment, index) =>
          segment.kind === 'text' ? (
            <Fragment key={index}>{segment.value}</Fragment>
          ) : (
            <input
              key={index}
              value={values[segment.value] ?? ''}
              onChange={(event) => update(segment.value, event.target.value)}
              placeholder={segment.value}
              className="inline-block min-w-[6ch] bg-zinc-900 border-b border-indigo-500/60 px-1 text-indigo-100 focus:outline-none"
              style={{ width: `${Math.max(8, (values[segment.value]?.length ?? 0) + 2)}ch` }}
            />
          ),
        )}
      </pre>

      <button
        type="button"
        onClick={handleCheck}
        className="rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-400"
      >
        Check blanks
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
          All blanks correct.
        </div>
      )}

      {state.kind === 'fail' && (
        <div className="rounded-md border border-rose-900/40 bg-rose-950/30 p-3 text-sm text-rose-200 space-y-1">
          <p className="font-medium">{state.failures.length} blank(s) incorrect.</p>
          <ul className="text-xs text-rose-100/80 list-disc pl-5">
            {state.failures.map((failure) => (
              <li key={failure.blank}>
                <code>{failure.blank}</code>: {failure.reason}
                {failure.got !== undefined && (
                  <>
                    {' '}got <code>{failure.got}</code>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
