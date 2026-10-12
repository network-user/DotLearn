import { useMemo, useRef, useState } from 'react';

import type { OnecCommand, OnecLabExercise } from '@dotlearn/contracts';
import { gradeOnecSession, runExercise } from '@dotlearn/lesson-engine';
import { RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { OnecCoach } from '@/components/onec/OnecCoach';
import { OnecStand } from '@/components/onec/OnecStand';
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

interface OnecLabRunnerProps {
  topicSlug: string;
  exercise: OnecLabExercise;
  conceptId?: string | undefined;
}

type GradeState = { kind: 'idle' } | { kind: 'pass' } | { kind: 'fail'; failure: FailureReason };

const commandLine = (command: OnecCommand): string => {
  switch (command.op) {
    case 'open-section':
      return `раздел ${command.section}`;
    case 'open-list':
      return `список ${command.object}`;
    case 'create-catalog':
      return `создать ${command.catalog}: ${command.name}`;
    case 'open-new-receipt':
      return 'новое поступление';
    case 'open-receipt':
      return `открыть ${command.id}`;
    case 'set-receipt-field':
      return `${command.field} = ${command.value}`;
    case 'add-receipt-line':
      return `строка ${command.product}, ${command.qty} x ${command.price}`;
    case 'remove-receipt-line':
      return `удалить строку ${command.index + 1}`;
    case 'save-receipt':
      return 'записать';
    case 'post-receipt':
      return 'провести';
    case 'unpost-receipt':
      return 'отмена проведения поступления';
    case 'open-new-sale':
      return 'новая реализация';
    case 'open-sale':
      return `открыть реализацию ${command.id}`;
    case 'set-sale-field':
      return `реализация ${command.field} = ${command.value}`;
    case 'add-sale-line':
      return `расход ${command.product}, ${command.qty} x ${command.price}`;
    case 'remove-sale-line':
      return `удалить строку реализации ${command.index + 1}`;
    case 'save-sale':
      return 'записать реализацию';
    case 'post-sale':
      return 'провести реализацию';
    case 'unpost-sale':
      return 'отмена проведения реализации';
    case 'toggle-mark-catalog':
      return `пометка ${command.catalog}: ${command.name}`;
    case 'toggle-mark-doc':
      return 'пометка документа';
    case 'run-query':
      return command.text;
    case 'close-form':
      return 'закрыть форму';
  }
};

export const OnecLabRunner = ({ topicSlug, exercise, conceptId }: OnecLabRunnerProps) => {
  const { t } = useTranslation('runners');
  const difficultyLabel = useDifficultyLabel(exercise.difficulty);
  const failureMessage = useFailureMessage();
  const [commands, setCommands] = useState<OnecCommand[]>([]);
  const [state, setState] = useState<GradeState>({ kind: 'idle' });
  const [pulse, setPulse] = useState(0);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [hintsExhausted, setHintsExhausted] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const passedRecorded = useRef(false);
  const standRef = useRef<HTMLDivElement>(null);

  const live = useMemo(() => gradeOnecSession(exercise, commands), [exercise, commands]);
  const doneCount = live.steps.filter((step) => step.ok).length;
  const allDone = live.steps.length > 0 && doneCount === live.steps.length;
  const current = live.steps.find((step) => !step.ok) ?? live.steps[live.steps.length - 1] ?? null;
  const currentStep = exercise.steps.find((step) => step.id === current?.id) ?? exercise.steps[0];

  const solutionUnlocked = hintsExhausted || failedAttempts >= 3;

  const grade = async (entered: OnecCommand[]): Promise<void> => {
    const result = await runExercise(exercise, entered);
    if (result.ok) {
      setState({ kind: 'pass' });
      if (!passedRecorded.current) {
        passedRecorded.current = true;
        toast.success(t('onec.solvedToast'));
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

  const update = (next: OnecCommand[]): void => {
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
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div ref={standRef} className="relative min-w-0">
          <OnecStand
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
        <aside className="space-y-3 rounded-xl border border-border bg-surface p-3">
          <p className="text-xs text-fg-muted">
            {t('onec.stepProgress', {
              current: doneCount,
              total: live.steps.length,
            })}
          </p>
          <ol className="space-y-1.5">
            {exercise.steps.map((step, index) => {
              const done = live.steps[index]?.ok === true;
              const active = step.id === currentStep?.id;
              return (
                <li
                  key={step.id}
                  className={cx(
                    'rounded-md px-2 py-1.5 text-sm',
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
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="primary"
              className="h-11 w-full sm:h-9"
              onClick={() => void grade(commands)}
              disabled={state.kind === 'pass'}
            >
              {t('onec.check')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-11 w-full sm:h-9"
              leadingIcon={<RotateCcw size={14} />}
              onClick={() => update([])}
            >
              {t('onec.reset')}
            </Button>
          </div>
        </aside>
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
