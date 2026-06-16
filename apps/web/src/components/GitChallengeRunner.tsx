import { useCallback, useMemo, useRef, useState } from 'react';

import type { GitChallengeExercise } from '@dotlearn/contracts';
import { runExercise } from '@dotlearn/lesson-engine';
import { GitCommit } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { GitTerminal } from '@/components/theory-viz/git/GitTerminal';
import { ExerciseCard, type ExerciseCardStatus } from '@/components/sandbox/ExerciseCard';
import { HintBlock } from '@/components/sandbox/HintBlock';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { burstConfetti } from '@/components/ui/confetti';
import { extractFailureReason, useFailureMessage, type FailureReason } from '@/lib/failure-reason';
import { recordAttempt } from '@/lib/progress-db';

import { useDifficultyLabel } from './ExerciseRunner';

interface GitChallengeRunnerProps {
  topicSlug: string;
  exercise: GitChallengeExercise;
}

type GradeState =
  | { kind: 'idle' }
  | { kind: 'pass' }
  | { kind: 'fail'; failure: FailureReason };

export const GitChallengeRunner = ({ topicSlug, exercise }: GitChallengeRunnerProps) => {
  const { t } = useTranslation('runners');
  const difficultyLabel = useDifficultyLabel(exercise.difficulty);
  const failureMessage = useFailureMessage();
  const [commands, setCommands] = useState<string[]>([]);
  const [state, setState] = useState<GradeState>({ kind: 'idle' });
  const [pulse, setPulse] = useState(0);
  const passedRecorded = useRef(false);

  const initial = useMemo(() => {
    const setup: { files?: Record<string, string>; commands?: string[] } = {};
    if (exercise.setup?.files !== undefined) {
      setup.files = exercise.setup.files;
    }
    if (exercise.setup?.commands !== undefined) {
      setup.commands = exercise.setup.commands;
    }
    return setup;
  }, [exercise.setup]);

  const grade = useCallback(
    async (enteredCommands: string[]): Promise<void> => {
      const result = await runExercise(exercise, enteredCommands);
      if (result.ok) {
        setState({ kind: 'pass' });
        if (!passedRecorded.current) {
          passedRecorded.current = true;
          toast.success(t('git.solvedToast', { defaultValue: 'Задача git решена' }), {
            description: exercise.id,
          });
          burstConfetti();
          void recordAttempt(topicSlug, exercise.id, 'pass');
        }
      } else {
        passedRecorded.current = false;
        setState({ kind: 'fail', failure: extractFailureReason(result) });
        void recordAttempt(topicSlug, exercise.id, 'fail');
      }
      setPulse((value) => value + 1);
    },
    [exercise, t, topicSlug],
  );

  const handleCommandsChange = useCallback((next: string[]): void => {
    setCommands(next);
    if (next.length === 0) {
      passedRecorded.current = false;
    }
    setState({ kind: 'idle' });
  }, []);

  const handleSolved = useCallback(
    (solvedCommands: string[]): void => {
      void grade(solvedCommands);
    },
    [grade],
  );

  const handleCheck = (): void => {
    void grade(commands);
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
        <GitTerminal
          initial={initial}
          goal={exercise.goal}
          onCommandsChange={handleCommandsChange}
          onSolved={handleSolved}
        />

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<GitCommit size={14} />}
            disabled={commands.length === 0 || state.kind === 'pass'}
            onClick={handleCheck}
            className="h-11 flex-1 sm:flex-initial sm:h-8"
          >
            {t('git.check', { defaultValue: 'Проверить' })}
          </Button>
          <Badge tone={state.kind === 'pass' ? 'success' : 'neutral'} variant="soft">
            {t('git.ranCount', {
              count: commands.length,
              defaultValue: '{{count}} команд выполнено',
            })}
          </Badge>
          <HintBlock hints={exercise.hints} />
        </div>

        {state.kind === 'pass' && (
          <div className="rounded-lg border border-ok/30 bg-ok/8 px-4 py-3 text-[13.5px] text-ok">
            {t('git.passed', { defaultValue: 'Все цели достигнуты.' })}
          </div>
        )}

        {state.kind === 'fail' && (
          <div className="rounded-lg border border-err/30 bg-err/8 px-4 py-3 text-[13.5px] text-err">
            {t('git.failed', {
              reason: failureMessage(state.failure),
              defaultValue: 'Ещё нет — {{reason}}.',
            })}
          </div>
        )}
      </div>
    </ExerciseCard>
  );
};
