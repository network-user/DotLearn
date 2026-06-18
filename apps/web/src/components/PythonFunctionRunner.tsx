import { useCallback, useMemo, useState } from 'react';

import type { PythonFunctionExercise } from '@dotlearn/contracts';
import { runPythonFunction } from '@dotlearn/lesson-engine';
import { AlertTriangle, Play, RotateCcw, Terminal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { ExerciseCard, type ExerciseCardStatus } from '@/components/sandbox/ExerciseCard';
import { HintBlock } from '@/components/sandbox/HintBlock';
import { LazyCodeEditor } from '@/components/sandbox/LazyCodeEditor';
import { RunnerStatus } from '@/components/sandbox/RunnerStatus';
import { SolutionReveal } from '@/components/sandbox/SolutionReveal';
import {
  PythonConsole,
  TestList,
  buildIdleLines,
  type ConsoleLine,
  type TestCardData,
} from '@/components/sandbox/PythonConsole';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { burstConfetti } from '@/components/ui/confetti';
import { cx } from '@/components/ui/cx';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { coarsePointerQuery, useMediaQuery } from '@/hooks/useMediaQuery';
import { buildEditorHeight, buildEditorOptions } from '@/lib/editor-options';
import { recordAttempt } from '@/lib/progress-db';
import { getPythonRuntime, prewarmPythonRuntime } from '@/lib/python-runtime';
import { classifyRuntimeError, type RuntimeErrorKind } from '@/lib/runtime-error';
import { useSettings } from '@/lib/settings';

import { useDifficultyLabel } from './ExerciseRunner';

interface PythonFunctionRunnerProps {
  topicSlug: string;
  exercise: PythonFunctionExercise;
}

interface CaseFailure {
  call: string;
  expected?: unknown;
  actual?: unknown;
  thrown?: { type: string; message: string };
}

type RunState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'running' }
  | { kind: 'pass'; casesPassed: number }
  | { kind: 'fail'; reason: string; failures: CaseFailure[] }
  | { kind: 'error'; message: string; runtimeKind: RuntimeErrorKind };

export const PythonFunctionRunner = ({ topicSlug, exercise }: PythonFunctionRunnerProps) => {
  const { t } = useTranslation('runners');
  const { t: tErr } = useTranslation('errors');
  const difficultyLabel = useDifficultyLabel(exercise.difficulty);
  const [answer, setAnswer] = useState<string>(exercise.starter);
  const [state, setState] = useState<RunState>({ kind: 'idle' });
  const [pulse, setPulse] = useState(0);
  const [consoleLines, setConsoleLines] = useState<ConsoleLine[]>(() =>
    buildIdleLines(`# ${exercise.cases.length} test case(s) ready`),
  );
  const [tab, setTab] = useState<'console' | 'tests' | 'starter'>('console');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [hintsExhausted, setHintsExhausted] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const isCoarsePointer = useMediaQuery(coarsePointerQuery);
  const editorPrefs = useSettings().editor;

  const solutionUnlocked = hintsExhausted || failedAttempts >= 3;

  const cardStatus: ExerciseCardStatus =
    state.kind === 'pass'
      ? 'pass'
      : state.kind === 'fail' || state.kind === 'error'
        ? 'fail'
        : 'idle';

  const consoleStatus =
    state.kind === 'loading'
      ? 'loading'
      : state.kind === 'running'
        ? 'running'
        : state.kind === 'pass'
          ? 'pass'
          : state.kind === 'fail'
            ? 'fail'
            : state.kind === 'error'
              ? 'error'
              : 'idle';

  const testCards: TestCardData[] = useMemo(() => {
    const failuresByCall = new Map<string, CaseFailure>();
    if (state.kind === 'fail') {
      for (const failure of state.failures) {
        failuresByCall.set(failure.call, failure);
      }
    }
    return exercise.cases.map((entry, index) => {
      const failure = failuresByCall.get(entry.call);
      const status: 'pending' | 'pass' | 'fail' =
        state.kind === 'pass'
          ? 'pass'
          : state.kind === 'fail'
            ? failure
              ? 'fail'
              : 'pass'
            : 'pending';
      return {
        id: `${entry.call}-${index}`,
        call: entry.call,
        status,
        ...(failure?.expected !== undefined ? { expected: failure.expected } : {}),
        ...(failure?.actual !== undefined ? { actual: failure.actual } : {}),
        ...(failure?.thrown !== undefined ? { thrown: failure.thrown } : {}),
      };
    });
  }, [exercise.cases, state]);

  const handleRun = useCallback(async () => {
    setState({ kind: 'loading' });
    setStatusMessage(t('common.status.running'));
    const session = pulse + 1;
    setPulse(session);
    setConsoleLines([
      { id: `s${session}-load`, tone: 'system', text: '$ python -m runner --load' },
    ]);
    setTab('console');
    try {
      const runtime = getPythonRuntime();
      await runtime.init();
      setState({ kind: 'running' });
      setConsoleLines((prev) => [
        ...prev,
        {
          id: `s${session}-run`,
          tone: 'system',
          text: `$ python -m runner --cases ${exercise.cases.length}`,
        },
      ]);
      const result = await runPythonFunction(exercise, answer, runtime);
      if (result.ok) {
        const details = (result.details ?? {}) as { casesPassed?: number };
        const passed = details.casesPassed ?? exercise.cases.length;
        setState({ kind: 'pass', casesPassed: passed });
        setConsoleLines((prev) => [
          ...prev,
          ...exercise.cases.map((entry, index) => ({
            id: `s${session}-c${index}`,
            tone: 'pass' as const,
            text: `[PASS] ${entry.call}`,
          })),
          {
            id: `s${session}-done`,
            tone: 'system',
            text: `\n${passed}/${exercise.cases.length} passed in 1 run.`,
          },
        ]);
        toast.success(t('python.allPassedToast'), { description: exercise.id });
        burstConfetti();
        setStatusMessage(t('common.status.passed', { passed, total: exercise.cases.length }));
        void recordAttempt(topicSlug, exercise.id, 'pass');
      } else {
        const details = (result.details ?? {}) as { failures?: CaseFailure[] };
        const failures = details.failures ?? [];
        const failed = new Set(failures.map((f) => f.call));
        setState({ kind: 'fail', reason: result.reason, failures });
        setConsoleLines((prev) => [
          ...prev,
          ...exercise.cases.map((entry, index) => {
            const failure = failures.find((f) => f.call === entry.call);
            if (!failure) {
              return {
                id: `s${session}-c${index}`,
                tone: 'pass' as const,
                text: `[PASS] ${entry.call}`,
              };
            }
            if (failure.thrown) {
              return {
                id: `s${session}-c${index}`,
                tone: 'fail' as const,
                text: `[FAIL] ${entry.call} → ${failure.thrown.type}: ${failure.thrown.message}`,
              };
            }
            return {
              id: `s${session}-c${index}`,
              tone: 'fail' as const,
              text: `[FAIL] ${entry.call} → expected ${JSON.stringify(failure.expected)}, got ${JSON.stringify(failure.actual)}`,
            };
          }),
          {
            id: `s${session}-done`,
            tone: 'meta',
            text: `\n${exercise.cases.length - failed.size}/${exercise.cases.length} passed.`,
          },
        ]);
        setFailedAttempts((count) => count + 1);
        setStatusMessage(t('common.status.failed', { reason: result.reason }));
        void recordAttempt(topicSlug, exercise.id, 'fail');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const runtimeKind = classifyRuntimeError(error);
      const friendly = tErr(`runtime.${runtimeKind}`);
      setState({ kind: 'error', message, runtimeKind });
      setStatusMessage(t('common.status.error', { message: friendly }));
      setConsoleLines((prev) => [
        ...prev,
        { id: `s${session}-err`, tone: 'fail', text: `[ERROR] ${friendly}` },
      ]);
    }
  }, [answer, exercise, pulse, t, tErr, topicSlug]);

  const handleReset = (): void => {
    setAnswer(exercise.starter);
    setState({ kind: 'idle' });
    setStatusMessage('');
    setConsoleLines(buildIdleLines(`# starter restored`));
  };

  const handleRevealSolution = (): void => {
    if (revealed) return;
    setRevealed(true);
    setStatusMessage(t('common.status.revealed'));
    void recordAttempt(topicSlug, exercise.id, 'fail');
  };

  const running = state.kind === 'loading' || state.kind === 'running';
  const passedCount = state.kind === 'pass' ? state.casesPassed : 0;

  return (
    <ExerciseCard
      type={exercise.type}
      prompt={exercise.prompt}
      difficultyLabel={difficultyLabel}
      status={cardStatus}
      pulse={pulse}
    >
      <RunnerStatus message={statusMessage} />
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
        <div className="space-y-3 min-w-0">
          <div
            className={cx(
              'overflow-hidden rounded-lg border border-border-base bg-surface',
              running && 'dl-anim-pulse-glow',
            )}
          >
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border-base bg-surface-2/60">
              <span className="eyebrow font-mono">python</span>
              {!isCoarsePointer && (
                <span className="text-[10.5px] text-fg-subtle">ctrl + enter</span>
              )}
            </div>
            <LazyCodeEditor
              value={answer}
              onChange={(value) => setAnswer(value ?? '')}
              language="python"
              height={buildEditorHeight(isCoarsePointer, '260px', 'min(45dvh, 320px)')}
              options={buildEditorOptions(isCoarsePointer, 4, editorPrefs)}
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
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-1 sm:flex-initial">
              <Button
                variant="primary"
                size="sm"
                leadingIcon={<Play size={14} />}
                loading={running}
                onClick={handleRun}
                onPointerEnter={prewarmPythonRuntime}
                onFocus={prewarmPythonRuntime}
                className="h-11 flex-1 sm:flex-initial sm:h-8"
              >
                {state.kind === 'loading'
                  ? t('python.loading')
                  : state.kind === 'running'
                    ? t('python.running')
                    : t('python.run')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                leadingIcon={<RotateCcw size={13} />}
                onClick={handleReset}
                className="h-11 sm:h-8"
              >
                reset
              </Button>
            </div>
            <Badge
              tone={state.kind === 'pass' ? 'success' : 'neutral'}
              variant="soft"
              icon={<Terminal size={11} />}
            >
              {state.kind === 'pass'
                ? t('python.passedCount', { passed: passedCount, total: exercise.cases.length })
                : t('python.cases', { count: exercise.cases.length })}
            </Badge>
          </div>
          {state.kind === 'error' && (
            <div
              role="alert"
              className="rounded-lg border border-warn/40 bg-warn/[0.06] p-3 space-y-2.5"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle size={15} className="mt-0.5 shrink-0 text-warn" />
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium text-fg">{tErr('runtime.title')}</p>
                  <p className="text-[13px] leading-relaxed text-fg-muted">
                    {tErr(`runtime.${state.runtimeKind}`)}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                leadingIcon={<RotateCcw size={13} />}
                onClick={handleRun}
                className="h-11 w-full min-h-[var(--tap)] sm:h-8 sm:w-auto sm:min-h-0"
              >
                {tErr('runtime.restart')}
              </Button>
            </div>
          )}
          <HintBlock hints={exercise.hints} onAllHintsShown={() => setHintsExhausted(true)} />
          <SolutionReveal
            solution={exercise.solution}
            language="python"
            unlocked={solutionUnlocked}
            onReveal={handleRevealSolution}
          />
        </div>

        <div className="min-w-0">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList>
              <TabsTrigger value="console">{t('python.tabs.console')}</TabsTrigger>
              <TabsTrigger value="tests">
                {t('python.tabs.tests')}
                <span
                  className={cx(
                    'ml-1 inline-block size-1.5 rounded-full',
                    state.kind === 'pass'
                      ? 'bg-ok'
                      : state.kind === 'fail'
                        ? 'bg-err'
                        : 'bg-fg-subtle/40',
                  )}
                />
              </TabsTrigger>
              <TabsTrigger value="starter">{t('python.tabs.starter')}</TabsTrigger>
            </TabsList>

            <TabsContent value="console">
              <PythonConsole
                lines={consoleLines}
                status={consoleStatus}
                emptyMessage={t('python.noOutput')}
              />
            </TabsContent>

            <TabsContent value="tests">
              <TestList cases={testCards} />
            </TabsContent>

            <TabsContent value="starter">
              <pre className="rounded-lg border border-border-base bg-code-bg p-3 text-[12.5px] font-mono text-fg overflow-x-auto leading-relaxed">
                {exercise.starter}
              </pre>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </ExerciseCard>
  );
};
