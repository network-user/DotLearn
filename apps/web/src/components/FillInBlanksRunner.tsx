import { Fragment, useMemo, useState } from 'react';

import type { FillInBlanksExercise } from '@dotlearn/contracts';
import { runFillInBlanks } from '@dotlearn/lesson-engine';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { ExerciseCard, type ExerciseCardStatus } from '@/components/sandbox/ExerciseCard';
import { HintBlock } from '@/components/sandbox/HintBlock';
import { Button } from '@/components/ui/Button';
import { burstConfetti } from '@/components/ui/confetti';
import { recordAttempt } from '@/lib/progress-db';

import { useDifficultyLabel } from './ExerciseRunner';

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
  | {
      kind: 'fail';
      failures: Array<{ blank: string; reason: string; got: string | undefined }>;
    };

export const FillInBlanksRunner = ({ topicSlug, exercise }: FillInBlanksRunnerProps) => {
  const { t } = useTranslation('runners');
  const difficultyLabel = useDifficultyLabel(exercise.difficulty);
  const segments = useMemo(() => splitTemplate(exercise.template), [exercise.template]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [state, setState] = useState<CheckState>({ kind: 'idle' });
  const [pulse, setPulse] = useState(0);

  const update = (blank: string, value: string): void => {
    setValues((prev) => ({ ...prev, [blank]: value }));
  };

  const handleCheck = (): void => {
    const result = runFillInBlanks(exercise, values);
    if (result.ok) {
      setState({ kind: 'pass' });
      toast.success(t('fillIn.correctToast'), { description: exercise.id });
      burstConfetti();
      void recordAttempt(topicSlug, exercise.id, 'pass');
    } else {
      const details = (result.details ?? {}) as {
        failures?: Array<{ blank: string; reason: string; got: string | undefined }>;
      };
      setState({ kind: 'fail', failures: details.failures ?? [] });
      void recordAttempt(topicSlug, exercise.id, 'fail');
    }
    setPulse((p) => p + 1);
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
      <div className="space-y-3">
        <pre className="rounded-lg border border-border-base bg-code-bg p-3.5 text-[12.5px] font-mono overflow-x-auto whitespace-pre leading-relaxed">
          {segments.map((segment, index) =>
            segment.kind === 'text' ? (
              <Fragment key={index}>{segment.value}</Fragment>
            ) : (
              <input
                key={index}
                value={values[segment.value] ?? ''}
                onChange={(event) => update(segment.value, event.target.value)}
                placeholder={segment.value}
                className="inline-block min-w-[6ch] bg-surface-2 border-b-2 border-accent/60 px-1.5 py-1 sm:py-0 sm:px-1 text-[16px] sm:text-[12.5px] text-accent rounded-sm focus:outline-none focus:border-accent focus:bg-accent/8 transition-colors"
                style={{ width: `${Math.max(8, (values[segment.value]?.length ?? 0) + 2)}ch` }}
              />
            ),
          )}
        </pre>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="primary"
            size="sm"
            onClick={handleCheck}
            className="h-11 flex-1 sm:flex-initial sm:h-8"
          >
            {t('fillIn.check')}
          </Button>
          <HintBlock hints={exercise.hints} />
        </div>

        {state.kind === 'pass' && (
          <div className="rounded-lg border border-ok/30 bg-ok/8 px-4 py-3 text-[13.5px] text-ok">
            {t('fillIn.correct')}
          </div>
        )}

        {state.kind === 'fail' && (
          <div className="rounded-lg border border-err/30 bg-err/8 px-4 py-3 text-[13.5px] text-err space-y-1.5">
            <p className="font-medium">
              {t('fillIn.wrongHeader', { count: state.failures.length })}
            </p>
            <ul className="text-[12.5px] text-err/80 space-y-1 font-mono">
              {state.failures.map((failure) => (
                <li key={failure.blank}>
                  <code className="text-err">{failure.blank}</code>:{' '}
                  {t(`fillIn.reason.${failure.reason}` as const, { defaultValue: failure.reason })}
                  {failure.got !== undefined && (
                    <>
                      {' · '}
                      {t('fillIn.got')}{' '}
                      <code className="text-err">{failure.got}</code>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ExerciseCard>
  );
};
