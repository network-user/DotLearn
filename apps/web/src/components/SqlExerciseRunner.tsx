import { useCallback, useMemo, useState } from 'react';

import type { SqlQueryExercise } from '@dotlearn/contracts';
import { runSqlQuery } from '@dotlearn/lesson-engine';
import Editor from '@monaco-editor/react';
import { Play } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { ExerciseCard, type ExerciseCardStatus } from '@/components/sandbox/ExerciseCard';
import { HintBlock } from '@/components/sandbox/HintBlock';
import { ResultGrid } from '@/components/sandbox/ResultGrid';
import { SqlVisualizer } from '@/components/sandbox/SqlVisualizer';
import { Button } from '@/components/ui/Button';
import { burstConfetti } from '@/components/ui/confetti';
import { cx } from '@/components/ui/cx';
import { recordAttempt } from '@/lib/progress-db';
import { getSqlRuntime } from '@/lib/sql-runtime';

import { useDifficultyLabel } from './ExerciseRunner';

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
      columns?: string[];
      rows?: Record<string, unknown>[];
      missing?: Record<string, unknown>[];
      extra?: Record<string, unknown>[];
      misordered?: boolean;
    }
  | { kind: 'error'; message: string };

export const SqlExerciseRunner = ({ topicSlug, exercise }: SqlExerciseRunnerProps) => {
  const { t } = useTranslation('runners');
  const difficultyLabel = useDifficultyLabel(exercise.difficulty);
  const initialAnswer = useMemo(() => t('sql.initial'), [t]);
  const [answer, setAnswer] = useState<string>(initialAnswer);
  const [state, setState] = useState<RunState>({ kind: 'idle' });
  const [pulse, setPulse] = useState(0);

  const status: ExerciseCardStatus =
    state.kind === 'pass' ? 'pass' : state.kind === 'fail' || state.kind === 'error' ? 'fail' : 'idle';

  const handleRun = useCallback(async () => {
    setState({ kind: 'running' });
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
          columns: execution.columns,
          rows: execution.rows,
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
    } finally {
      setPulse((p) => p + 1);
    }
  }, [answer, exercise, topicSlug, t]);

  const visualizerResult =
    state.kind === 'pass' || state.kind === 'fail'
      ? { columns: state.columns ?? [], rows: state.rows ?? [] }
      : undefined;
  const visualizerStatus = state.kind === 'pass' ? 'pass' : state.kind === 'fail' ? 'fail' : undefined;

  return (
    <ExerciseCard
      type={exercise.type}
      prompt={exercise.prompt}
      difficultyLabel={difficultyLabel}
      status={status}
      pulse={pulse}
    >
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="space-y-3 min-w-0">
          <div
            className={cx(
              'overflow-hidden rounded-xl border border-border-base bg-canvas/80 backdrop-blur-soft',
              state.kind === 'running' && 'dl-anim-pulse-glow',
            )}
          >
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border-base bg-surface/40">
              <span className="text-[10.5px] uppercase tracking-widest text-fg-subtle font-mono">
                sql
              </span>
              <span className="text-[10.5px] text-fg-subtle">ctrl + enter</span>
            </div>
            <Editor
              value={answer}
              onChange={(value) => setAnswer(value ?? '')}
              language="sql"
              theme="vs-dark"
              height="200px"
              options={{
                fontSize: 13,
                minimap: { enabled: false },
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                automaticLayout: true,
                tabSize: 2,
                padding: { top: 12, bottom: 12 },
              }}
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
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<Play size={14} />}
              loading={state.kind === 'running'}
              onClick={handleRun}
            >
              {state.kind === 'running' ? t('sql.running') : t('sql.run')}
            </Button>
            <HintBlock hints={exercise.hints} />
          </div>
          {state.kind === 'error' && (
            <p className="rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-2 text-[13px] text-amber-300">
              {t('sql.runtimeError', { message: state.message })}
            </p>
          )}
          {state.kind === 'fail' && (
            <div className="space-y-2">
              <p className="text-[13px] text-rose-300">
                {t('sql.fail', { reason: state.reason })}
              </p>
              {state.missing && state.missing.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10.5px] uppercase tracking-widest text-fg-subtle">
                    {t('sql.missingRows')}
                  </p>
                  <ResultGrid
                    columns={Object.keys(state.missing[0] ?? {})}
                    rows={state.missing}
                    highlight="expected"
                  />
                </div>
              )}
              {state.extra && state.extra.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10.5px] uppercase tracking-widest text-fg-subtle">
                    {t('sql.extraRows')}
                  </p>
                  <ResultGrid
                    columns={Object.keys(state.extra[0] ?? {})}
                    rows={state.extra}
                    highlight="fail"
                  />
                </div>
              )}
              {state.misordered && (
                <p className="text-[12.5px] text-amber-300">{t('sql.misordered')}</p>
              )}
            </div>
          )}
          {state.kind === 'pass' && (
            <p className="text-[13px] text-emerald-300 font-medium">{t('sql.pass')}</p>
          )}
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
