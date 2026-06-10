import { useState } from 'react';

import type { PredictOutputExercise } from '@dotlearn/contracts';
import { runPredictOutput } from '@dotlearn/lesson-engine';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { ExerciseCard, type ExerciseCardStatus } from '@/components/sandbox/ExerciseCard';
import { HintBlock } from '@/components/sandbox/HintBlock';
import { Button } from '@/components/ui/Button';
import { burstConfetti } from '@/components/ui/confetti';
import { extractFailureReason, useFailureMessage, type FailureReason } from '@/lib/failure-reason';
import { recordAttempt } from '@/lib/progress-db';

import { useDifficultyLabel } from './ExerciseRunner';

interface PredictOutputRunnerProps {
  topicSlug: string;
  exercise: PredictOutputExercise;
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

export const PredictOutputRunner = ({ topicSlug, exercise }: PredictOutputRunnerProps) => {
  const { t } = useTranslation('runners');
  const difficultyLabel = useDifficultyLabel(exercise.difficulty);
  const failureMessage = useFailureMessage();
  const [draft, setDraft] = useState('');
  const [state, setState] = useState<CheckState>({ kind: 'idle' });
  const [pulse, setPulse] = useState(0);

  const handleCheck = (): void => {
    const value =
      exercise.expected.kind === 'scalar'
        ? parseScalar(draft)
        : exercise.expected.kind === 'stdout'
          ? draft
          : draft;
    const result = runPredictOutput(exercise, value);
    if (result.ok) {
      setState({ kind: 'pass' });
      toast.success(t('predict.correctToast'), { description: exercise.id });
      burstConfetti();
      void recordAttempt(topicSlug, exercise.id, 'pass');
    } else {
      const details = (result.details ?? {}) as { expected?: unknown; actual?: unknown };
      setState({
        kind: 'fail',
        failure: extractFailureReason(result),
        ...(details.expected !== undefined ? { expected: details.expected } : {}),
        ...(details.actual !== undefined ? { actual: details.actual } : {}),
      });
      void recordAttempt(topicSlug, exercise.id, 'fail');
    }
    setPulse((p) => p + 1);
  };

  const inputHint =
    exercise.expected.kind === 'scalar'
      ? t('predict.hint.scalar')
      : exercise.expected.kind === 'stdout'
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
        <pre className="rounded-lg border border-border-base bg-code-bg p-3.5 text-[12.5px] font-mono overflow-x-auto whitespace-pre leading-relaxed text-fg">
          {exercise.snippet}
        </pre>
        {exercise.expected.kind === 'stdout' ? (
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
            disabled={draft.trim().length === 0}
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
            <p className="font-medium">{t('predict.wrong', { reason: failureMessage(state.failure) })}</p>
            {state.expected !== undefined && (
              <p className="text-[12px] text-err/80 font-mono">
                {t('predict.expected')}:{' '}
                <code className="text-ok">{JSON.stringify(state.expected)}</code>
              </p>
            )}
            {state.actual !== undefined && (
              <p className="text-[12px] text-err/80 font-mono">
                {t('predict.got')}:{' '}
                <code className="text-err">{JSON.stringify(state.actual)}</code>
              </p>
            )}
          </div>
        )}
      </div>
    </ExerciseCard>
  );
};
