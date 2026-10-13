import { useMemo, useRef, useState } from 'react';

import type { DesignerCommand, DesignerExercise } from '@dotlearn/contracts';
import { gradeDesignerSession, runExercise } from '@dotlearn/lesson-engine';
import { RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { DesignerStand } from '@/components/onec/DesignerStand';
import { OnecCoach } from '@/components/onec/OnecCoach';
import { ExerciseCard, type ExerciseCardStatus } from '@/components/sandbox/ExerciseCard';
import { HintBlock } from '@/components/sandbox/HintBlock';
import { RunnerStatus } from '@/components/sandbox/RunnerStatus';
import { SolutionReveal } from '@/components/sandbox/SolutionReveal';
import { Button } from '@/components/ui/Button';
import { burstConfetti } from '@/components/ui/confetti';
import { cx } from '@/components/ui/cx';
import { extractFailureReason, useFailureMessage, type FailureReason } from '@/lib/failure-reason';
import { recordAttempt } from '@/lib/progress-db';

import { useDifficultyLabel } from './ExerciseRunner';

interface DesignerRunnerProps {
  topicSlug: string;
  exercise: DesignerExercise;
  conceptId?: string | undefined;
}

type GradeState = { kind: 'idle' } | { kind: 'pass' } | { kind: 'fail'; failure: FailureReason };

const commandLine = (command: DesignerCommand): string => {
  switch (command.op) {
    case 'open-mode':
      return `раздел ${command.mode}`;
    case 'add-catalog':
      return `справочник ${command.name}`;
    case 'add-document':
      return `документ ${command.name}`;
    case 'add-register':
      return `регистр ${command.name}`;
    case 'add-dimension':
      return `измерение ${command.register}.${command.name} -> ${command.catalog}`;
    case 'add-field':
      return `реквизит ${command.object}.${command.name}: ${command.type}`;
    case 'add-movement':
      return `${command.direction === 'in' ? 'приход' : 'расход'} ${command.document} -> ${command.register}`;
    case 'add-guard':
      return `условие ${command.document}: ${command.guard.kind}`;
    case 'open-object':
      return `открыть ${command.name}`;
    case 'open-new':
      return `создать ${command.object}`;
    case 'set-value':
      return `${command.field} = ${command.value}`;
    case 'save':
      return 'записать';
    case 'post':
      return 'провести';
    case 'close':
      return 'закрыть';
  }
};

export const DesignerRunner = ({ topicSlug, exercise, conceptId }: DesignerRunnerProps) => {
  const { t } = useTranslation('runners');
  const difficultyLabel = useDifficultyLabel(exercise.difficulty);
  const failureMessage = useFailureMessage();
  const [commands, setCommands] = useState<DesignerCommand[]>([]);
  const [state, setState] = useState<GradeState>({ kind: 'idle' });
  const [pulse, setPulse] = useState(0);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [hintsExhausted, setHintsExhausted] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const passedRecorded = useRef(false);
  const standRef = useRef<HTMLDivElement>(null);

  const live = useMemo(() => gradeDesignerSession(exercise, commands), [exercise, commands]);
  const doneCount = live.steps.filter((step) => step.ok).length;
  const allDone = live.steps.length > 0 && doneCount === live.steps.length;
  const current = live.steps.find((step) => !step.ok) ?? live.steps[live.steps.length - 1] ?? null;
  const currentStep = exercise.steps.find((step) => step.id === current?.id) ?? exercise.steps[0];

  const solutionUnlocked = hintsExhausted || failedAttempts >= 3;

  const grade = async (entered: DesignerCommand[]): Promise<void> => {
    const result = await runExercise(exercise, entered);
    if (result.ok) {
      setState({ kind: 'pass' });
      if (!passedRecorded.current) {
        passedRecorded.current = true;
        toast.success(t('designer.solvedToast'));
        burstConfetti();
        setStatusMessage(t('common.status.passedSimple'));
        void recordAttempt(topicSlug, exercise.id, 'pass', {
          difficulty: exercise.difficulty,
          concept: conceptId,
        });
      }
    } else {
      passedRecorded.current = false;
      const failure = extractFailureReason(result);
      setState({ kind: 'fail', failure });
      setFailedAttempts((count) => count + 1);
      setStatusMessage(t('common.status.failed', { reason: failureMessage(failure) }));
      void recordAttempt(topicSlug, exercise.id, 'fail', {
        difficulty: exercise.difficulty,
        concept: conceptId,
      });
    }
    setPulse((value) => value + 1);
  };

  const update = (next: DesignerCommand[]): void => {
    setCommands(next);
    setState({ kind: 'idle' });
    if (next.length === 0) passedRecorded.current = false;
  };

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
      <RunnerStatus message={statusMessage} />
      <div className="flex min-w-0 flex-col gap-3">
        <aside className="space-y-2 rounded-xl border border-border bg-surface p-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-fg-muted">
              {t('designer.stepProgress', {
                current: doneCount,
                total: live.steps.length,
              })}
            </p>
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              <Button
                type="button"
                variant="primary"
                className="h-11 sm:h-9"
                onClick={() => void grade(commands)}
                disabled={state.kind === 'pass'}
              >
                {t('designer.check')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-11 sm:h-9"
                leadingIcon={<RotateCcw size={14} />}
                onClick={() => update([])}
              >
                {t('designer.reset')}
              </Button>
            </div>
          </div>
          <ol className="flex min-w-0 gap-1.5 overflow-x-auto pb-1">
            {exercise.steps.map((step, index) => {
              const done = live.steps[index]?.ok === true;
              const active = step.id === currentStep?.id;
              return (
                <li
                  key={step.id}
                  className={cx(
                    'shrink-0 whitespace-nowrap rounded-md px-2 py-1.5 text-sm',
                    active ? 'bg-surface-2 text-fg' : 'text-fg-muted',
                  )}
                >
                  <span
                    className={cx(
                      'mr-2 inline-block h-2 w-2 rounded-full align-middle',
                      done ? 'bg-accent' : 'border border-border bg-transparent',
                    )}
                    aria-hidden
                  />
                  {step.title}
                </li>
              );
            })}
          </ol>
          {currentStep && allDone ? (
            <p className="text-sm leading-relaxed text-fg">{currentStep.coach}</p>
          ) : null}
        </aside>
        <div ref={standRef} className="relative min-w-0">
          <DesignerStand
            seed={exercise.seed}
            commands={commands}
            onChange={update}
            focus={allDone ? undefined : currentStep?.focus}
          />
          {currentStep && !allDone ? (
            <OnecCoach
              rootRef={standRef}
              title={currentStep.title}
              body={currentStep.coach}
              index={Math.max(
                0,
                exercise.steps.findIndex((step) => step.id === currentStep.id),
              )}
              total={exercise.steps.length}
              revision={`${commands.length}:${currentStep.id}`}
            />
          ) : null}
        </div>
      </div>
      <HintBlock hints={exercise.hints} onAllHintsShown={() => setHintsExhausted(true)} />
      <SolutionReveal
        solution={exercise.solution.map(commandLine).join('\n')}
        language="text"
        unlocked={solutionUnlocked}
      />
    </ExerciseCard>
  );
};
