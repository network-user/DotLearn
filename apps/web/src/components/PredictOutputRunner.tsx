import { useMemo, useState } from 'react';

import type { PredictOutputExercise } from '@dotlearn/contracts';
import { runPredictOutput } from '@dotlearn/lesson-engine';
import { Plus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { ExerciseCard, type ExerciseCardStatus } from '@/components/sandbox/ExerciseCard';
import { HintBlock } from '@/components/sandbox/HintBlock';
import { parseSqlFixture } from '@/components/sandbox/parseSqlFixture';
import { SqlSchemaPreview } from '@/components/sandbox/SqlSchemaPreview';
import { Button } from '@/components/ui/Button';
import { burstConfetti } from '@/components/ui/confetti';
import { extractFailureReason, useFailureMessage, type FailureReason } from '@/lib/failure-reason';
import { recordAttempt } from '@/lib/progress-db';

import { useDifficultyLabel } from './ExerciseRunner';

interface PredictOutputRunnerProps {
  topicSlug: string;
  exercise: PredictOutputExercise;
  conceptId?: string | undefined;
}

type CheckState =
  | { kind: 'idle' }
  | { kind: 'pass' }
  | { kind: 'fail'; failure: FailureReason; expected?: unknown; actual?: unknown };

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

type GridRow = Record<string, string>;

const emptyRow = (columns: string[]): GridRow =>
  Object.fromEntries(columns.map((column) => [column, '']));

export const PredictOutputRunner = ({
  topicSlug,
  exercise,
  conceptId,
}: PredictOutputRunnerProps) => {
  const { t } = useTranslation('runners');
  const difficultyLabel = useDifficultyLabel(exercise.difficulty);
  const failureMessage = useFailureMessage();
  const expected = exercise.expected;
  const isResultSet = expected.kind === 'result-set';
  const columns = useMemo(
    () => (expected.kind === 'result-set' ? Object.keys(expected.rows[0] ?? {}) : []),
    [expected],
  );
  const [draft, setDraft] = useState('');
  const [gridRows, setGridRows] = useState<GridRow[]>(() =>
    expected.kind === 'result-set' ? [emptyRow(Object.keys(expected.rows[0] ?? {}))] : [],
  );
  const [state, setState] = useState<CheckState>({ kind: 'idle' });
  const [pulse, setPulse] = useState(0);

  const fixture = exercise.fixture;
  const hasSqlTables = useMemo(
    () => (fixture ? parseSqlFixture(fixture).length > 0 : false),
    [fixture],
  );

  const setCell = (rowIndex: number, column: string, cellValue: string): void => {
    setGridRows((rows) =>
      rows.map((row, index) => (index === rowIndex ? { ...row, [column]: cellValue } : row)),
    );
  };

  const addRow = (): void => {
    setGridRows((rows) => [...rows, emptyRow(columns)]);
  };

  const removeRow = (rowIndex: number): void => {
    setGridRows((rows) => rows.filter((_, index) => index !== rowIndex));
  };

  const handleCheck = (): void => {
    const value =
      expected.kind === 'scalar'
        ? parseScalar(draft)
        : expected.kind === 'stdout'
          ? draft
          : gridRows.map((row) =>
              Object.fromEntries(columns.map((column) => [column, parseScalar(row[column] ?? '')])),
            );
    const result = runPredictOutput(exercise, value);
    if (result.ok) {
      setState({ kind: 'pass' });
      toast.success(t('predict.correctToast'), { description: exercise.id });
      burstConfetti();
      void recordAttempt(topicSlug, exercise.id, 'pass', {
        difficulty: exercise.difficulty,
        concept: conceptId,
      });
    } else {
      const details = (result.details ?? {}) as { expected?: unknown; actual?: unknown };
      setState({
        kind: 'fail',
        failure: extractFailureReason(result),
        ...(details.expected !== undefined ? { expected: details.expected } : {}),
        ...(details.actual !== undefined ? { actual: details.actual } : {}),
      });
      void recordAttempt(topicSlug, exercise.id, 'fail', {
        difficulty: exercise.difficulty,
        concept: conceptId,
      });
    }
    setPulse((p) => p + 1);
  };

  const inputHint =
    expected.kind === 'scalar'
      ? t('predict.hint.scalar')
      : expected.kind === 'stdout'
        ? t('predict.hint.stdout')
        : t('predict.hint.rows');

  const status: ExerciseCardStatus =
    state.kind === 'pass' ? 'pass' : state.kind === 'fail' ? 'fail' : 'idle';

  return (
    <ExerciseCard
      type={exercise.type}
      prompt={exercise.prompt}
      difficultyLabel={difficultyLabel}
      status={status}
      pulse={pulse}
    >
      <div className="space-y-3">
        {fixture && (
          <div className="space-y-1.5">
            <p className="eyebrow text-fg-subtle">{t('predict.fixtureLabel')}</p>
            {hasSqlTables ? (
              <SqlSchemaPreview fixture={fixture} />
            ) : (
              <pre className="rounded-lg border border-border-base bg-code-bg p-3.5 text-[12.5px] font-mono overflow-x-auto whitespace-pre leading-relaxed text-fg">
                {fixture}
              </pre>
            )}
          </div>
        )}
        <pre className="rounded-lg border border-border-base bg-code-bg p-3.5 text-[12.5px] font-mono overflow-x-auto whitespace-pre leading-relaxed text-fg">
          {exercise.snippet}
        </pre>
        {isResultSet ? (
          <div className="space-y-2">
            <p className="text-[12px] text-fg-subtle">{inputHint}</p>
            <div className="overflow-x-auto rounded-lg border border-border-base">
              <table className="w-full border-collapse text-[12.5px] font-mono">
                <thead>
                  <tr className="bg-surface-2/60">
                    {columns.map((column) => (
                      <th
                        key={column}
                        className="border-b border-border-base px-2.5 py-1.5 text-left font-medium text-fg-muted"
                      >
                        {column}
                      </th>
                    ))}
                    <th className="w-10 border-b border-border-base px-2 py-1.5" aria-hidden />
                  </tr>
                </thead>
                <tbody>
                  {gridRows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b border-border-base/60 last:border-0">
                      {columns.map((column) => (
                        <td key={column} className="px-1.5 py-1">
                          <input
                            value={row[column] ?? ''}
                            onChange={(event) => setCell(rowIndex, column, event.target.value)}
                            className="w-full min-w-[6ch] rounded-md border border-transparent bg-code-bg px-2 py-1.5 text-[16px] sm:text-[13px] text-fg focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
                          />
                        </td>
                      ))}
                      <td className="px-1 py-1 text-center align-middle">
                        <button
                          type="button"
                          onClick={() => removeRow(rowIndex)}
                          aria-label={t('predict.grid.removeRow')}
                          className="inline-flex size-7 items-center justify-center rounded-md text-fg-subtle hover:bg-surface-2 hover:text-err"
                        >
                          <X size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={addRow}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-accent hover:underline underline-offset-2 min-h-[var(--tap)] sm:min-h-0"
            >
              <Plus size={13} />
              {t('predict.grid.addRow')}
            </button>
          </div>
        ) : expected.kind === 'stdout' ? (
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={inputHint}
            rows={3}
            className="w-full rounded-lg border border-border-base bg-code-bg px-3 py-2 text-[16px] sm:text-[13px] font-mono text-fg placeholder:text-fg-subtle focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
          />
        ) : (
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={inputHint}
            className="w-full rounded-lg border border-border-base bg-code-bg px-3 py-2 min-h-[var(--tap)] sm:min-h-0 text-[16px] sm:text-[13px] font-mono text-fg placeholder:text-fg-subtle focus:outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
          />
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="primary"
            size="sm"
            disabled={isResultSet ? gridRows.length === 0 : draft.trim().length === 0}
            onClick={handleCheck}
            className="h-11 flex-1 sm:flex-initial sm:h-8"
          >
            {t('predict.check')}
          </Button>
          <HintBlock hints={exercise.hints} />
        </div>

        {state.kind === 'pass' && (
          <div className="rounded-lg border border-ok/30 bg-ok/8 px-4 py-3 text-[13.5px] text-ok">
            {t('predict.correct')}
          </div>
        )}

        {state.kind === 'fail' && (
          <div className="rounded-lg border border-err/30 bg-err/8 px-4 py-3 text-[13.5px] text-err space-y-1">
            <p className="font-medium">
              {t('predict.wrong', { reason: failureMessage(state.failure) })}
            </p>
            {state.expected !== undefined && (
              <p className="text-[12px] text-err/80 font-mono">
                {t('predict.expected')}:{' '}
                <code className="text-ok">{JSON.stringify(state.expected)}</code>
              </p>
            )}
            {state.actual !== undefined && (
              <p className="text-[12px] text-err/80 font-mono">
                {t('predict.got')}: <code className="text-err">{JSON.stringify(state.actual)}</code>
              </p>
            )}
          </div>
        )}
      </div>
    </ExerciseCard>
  );
};
