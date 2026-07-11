import { useCallback, useMemo, useState } from 'react';

import type { SqlQueryExercise } from '@dotlearn/contracts';
import { runSqlQuery } from '@dotlearn/lesson-engine';
import { Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { ExerciseCard, type ExerciseCardStatus } from '@/components/sandbox/ExerciseCard';
import { HintBlock } from '@/components/sandbox/HintBlock';
import { LazyCodeEditor } from '@/components/sandbox/LazyCodeEditor';
import { ResultGrid } from '@/components/sandbox/ResultGrid';
import { RunnerStatus } from '@/components/sandbox/RunnerStatus';
import { SolutionReveal } from '@/components/sandbox/SolutionReveal';
import { SqlVisualizer } from '@/components/sandbox/SqlVisualizer';
import { Button } from '@/components/ui/Button';
import { burstConfetti } from '@/components/ui/confetti';
import { cx } from '@/components/ui/cx';
import { coarsePointerQuery, useMediaQuery } from '@/hooks/useMediaQuery';
import { buildEditorHeight, buildEditorOptions } from '@/lib/editor-options';
import { extractFailureReason, useFailureMessage, type FailureReason } from '@/lib/failure-reason';
import { recordAttempt } from '@/lib/progress-db';
import { getSqlRuntime } from '@/lib/sql-runtime';

import { useDifficultyLabel } from './ExerciseRunner';

interface SqlExerciseRunnerProps {
  topicSlug: string;
  exercise: SqlQueryExercise;
  conceptId?: string | undefined;
}

type RunState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'pass'; columns: string[]; rows: Record<string, unknown>[] }
  | {
      kind: 'fail';
      failure: FailureReason;
      columns?: string[];
      rows?: Record<string, unknown>[];
      missing?: Record<string, unknown>[];
      extra?: Record<string, unknown>[];
      misordered?: boolean;
    }
  | { kind: 'error'; message: string };

export const SqlExerciseRunner = ({ topicSlug, exercise, conceptId }: SqlExerciseRunnerProps) => {
  const { t } = useTranslation('runners');
  const difficultyLabel = useDifficultyLabel(exercise.difficulty);
  const failureMessage = useFailureMessage();
  const initialAnswer = useMemo(() => t('sql.initial'), [t]);
  const [answer, setAnswer] = useState<string>(initialAnswer);
  const [state, setState] = useState<RunState>({ kind: 'idle' });
  const [pulse, setPulse] = useState(0);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [hintsExhausted, setHintsExhausted] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const isCoarsePointer = useMediaQuery(coarsePointerQuery);
  const editorOptions = useMemo(() => buildEditorOptions(isCoarsePointer, 2), [isCoarsePointer]);

  const solutionUnlocked = hintsExhausted || failedAttempts >= 3;

  const status: ExerciseCardStatus =
    state.kind === 'pass'
      ? 'pass'
      : state.kind === 'fail' || state.kind === 'error'
        ? 'fail'
        : 'idle';

  const handleRun = useCallback(async () => {
    setState({ kind: 'running' });
    setStatusMessage(t('common.status.running'));
    try {
      const runtime = getSqlRuntime();
      const execution = await runtime.execute(answer, exercise.fixture).catch((error) => {
        throw error;
      });
      const result = await runSqlQuery(exercise, answer, runtime);
      if (result.ok) {
        setState({ kind: 'pass', columns: execution.columns, rows: execution.rows });
        toast.success(t('sql.correctToast'), { description: exercise.id });
        burstConfetti();
        setStatusMessage(t('common.status.passedSimple'));
        void recordAttempt(topicSlug, exercise.id, 'pass', {
          difficulty: exercise.difficulty,
          concept: conceptId,
        });
      } else {
        const details = (result.details ?? {}) as {
          missing?: Record<string, unknown>[];
          extra?: Record<string, unknown>[];
          misordered?: boolean;
        };
        const failure = extractFailureReason(result);
        setState({
          kind: 'fail',
          failure,
          columns: execution.columns,
          rows: execution.rows,
          ...(details.missing !== undefined ? { missing: details.missing } : {}),
          ...(details.extra !== undefined ? { extra: details.extra } : {}),
          ...(details.misordered !== undefined ? { misordered: details.misordered } : {}),
        });
        setFailedAttempts((count) => count + 1);
        setStatusMessage(t('common.status.failed', { reason: failureMessage(failure) }));
        void recordAttempt(topicSlug, exercise.id, 'fail', {
          difficulty: exercise.difficulty,
          concept: conceptId,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setState({ kind: 'error', message });
      setStatusMessage(t('common.status.error', { message }));
    } finally {
      setPulse((p) => p + 1);
    }
  }, [answer, exercise, topicSlug, t, failureMessage, conceptId]);

  const handleRevealSolution = (): void => {
    if (revealed) return;
    setRevealed(true);
    setStatusMessage(t('common.status.revealed'));
    void recordAttempt(topicSlug, exercise.id, 'fail', {
      difficulty: exercise.difficulty,
      concept: conceptId,
    });
  };

  const visualizerResult =
    state.kind === 'pass' || state.kind === 'fail'
      ? { columns: state.columns ?? [], rows: state.rows ?? [] }
      : undefined;
  const visualizerStatus =
    state.kind === 'pass' ? 'pass' : state.kind === 'fail' ? 'fail' : undefined;

  return (
    <ExerciseCard
      type={exercise.type}
      prompt={exercise.prompt}
      difficultyLabel={difficultyLabel}
      status={status}
      pulse={pulse}
    >
      <RunnerStatus message={statusMessage} />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="space-y-3 min-w-0">
          <div
            className={cx(
              'overflow-hidden rounded-lg border border-border-base bg-surface',
              state.kind === 'running' && 'dl-anim-pulse-glow',
            )}
          >
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border-base bg-surface-2/60">
              <span className="eyebrow font-mono">sql</span>
              {!isCoarsePointer && (
                <span className="text-[10.5px] text-fg-subtle">ctrl + enter</span>
              )}
            </div>
            <LazyCodeEditor
              value={answer}
              onChange={(value) => setAnswer(value ?? '')}
              language="sql"
              sqlSchema={exercise.fixture}
              height={buildEditorHeight(isCoarsePointer, '200px', 'min(40dvh, 280px)')}
              options={editorOptions}
              onMount={(editor) => {
                editor.onKeyDown((event) => {
                  if ((event.ctrlKey || event.metaKey) && event.code === 'Enter') {
                    event.preventDefault();
                    event.stopPropagation();
                    void handleRun();
                  }
                });
              }}
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<Play size={14} />}
              loading={state.kind === 'running'}
              onClick={handleRun}
              className="h-11 flex-1 sm:flex-initial sm:h-8"
            >
              {state.kind === 'running' ? t('sql.running') : t('sql.run')}
            </Button>
            <HintBlock hints={exercise.hints} onAllHintsShown={() => setHintsExhausted(true)} />
          </div>
          {state.kind === 'error' && (
            <p className="rounded-lg border border-warn/30 bg-warn/8 px-3 py-2 text-[13px] text-warn">
              {t('sql.runtimeError', { message: state.message })}
            </p>
          )}
          {state.kind === 'fail' && (
            <div className="space-y-2">
              <p className="text-[13px] text-err">
                {t('sql.fail', { reason: failureMessage(state.failure) })}
              </p>
              {state.missing && state.missing.length > 0 && (
                <div className="space-y-1">
                  <p className="eyebrow">{t('sql.missingRows')}</p>
                  <ResultGrid
                    columns={Object.keys(state.missing[0] ?? {})}
                    rows={state.missing}
                    highlight="expected"
                  />
                </div>
              )}
              {state.extra && state.extra.length > 0 && (
                <div className="space-y-1">
                  <p className="eyebrow">{t('sql.extraRows')}</p>
                  <ResultGrid
                    columns={Object.keys(state.extra[0] ?? {})}
                    rows={state.extra}
                    highlight="fail"
                  />
                </div>
              )}
              {state.misordered && <p className="text-[12.5px] text-warn">{t('sql.misordered')}</p>}
            </div>
          )}
          {state.kind === 'pass' && (
            <p className="text-[13px] text-ok font-medium">{t('sql.pass')}</p>
          )}
          <SolutionReveal
            solution={exercise.solution}
            language="sql"
            unlocked={solutionUnlocked}
            onReveal={handleRevealSolution}
          />
        </div>

        <div className="min-w-0">
          <SqlVisualizer
            fixture={exercise.fixture}
            expected={
              exercise.expected.kind === 'result-set'
                ? {
                    kind: 'result-set',
                    rows: exercise.expected.rows,
                    columns: Object.keys(exercise.expected.rows[0] ?? {}),
                  }
                : { kind: 'scalar', value: exercise.expected.value }
            }
            result={visualizerResult}
            resultStatus={visualizerStatus}
          />
        </div>
      </div>
    </ExerciseCard>
  );
};
