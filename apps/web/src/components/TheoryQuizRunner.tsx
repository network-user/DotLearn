import { useState } from 'react';

import type { TheoryQuizExercise } from '@dotlearn/contracts';
import { runTheoryQuiz } from '@dotlearn/lesson-engine';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, CheckCircle2, Circle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ExerciseCard, type ExerciseCardStatus } from '@/components/sandbox/ExerciseCard';
import { HintBlock } from '@/components/sandbox/HintBlock';
import { Button } from '@/components/ui/Button';
import { burstConfetti } from '@/components/ui/confetti';
import { cx } from '@/components/ui/cx';
import { recordAttempt } from '@/lib/progress-db';

import { useDifficultyLabel } from './ExerciseRunner';

interface TheoryQuizRunnerProps {
  topicSlug: string;
  exercise: TheoryQuizExercise;
}

type CheckState =
  | { kind: 'idle' }
  | { kind: 'pass'; explanation?: string }
  | {
      kind: 'fail';
      reason: string;
      missing?: string[];
      unexpected?: string[];
      explanation?: string;
    };

export const TheoryQuizRunner = ({ topicSlug, exercise }: TheoryQuizRunnerProps) => {
  const { t } = useTranslation('runners');
  const difficultyLabel = useDifficultyLabel(exercise.difficulty);
  const allowMultiple = exercise.correct.length > 1;
  const [selected, setSelected] = useState<string[]>([]);
  const [state, setState] = useState<CheckState>({ kind: 'idle' });
  const [pulse, setPulse] = useState(0);

  const toggle = (id: string): void => {
    setSelected((prev) => {
      if (allowMultiple) {
        return prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id];
      }
      return [id];
    });
    setState({ kind: 'idle' });
  };

  const handleCheck = (): void => {
    const result = runTheoryQuiz(exercise, selected);
    if (result.ok) {
      const details = (result.details ?? {}) as { explanation?: string };
      setState({
        kind: 'pass',
        ...(details.explanation !== undefined ? { explanation: details.explanation } : {}),
      });
      burstConfetti();
      void recordAttempt(topicSlug, exercise.id, 'pass');
    } else {
      const details = (result.details ?? {}) as {
        missing?: string[];
        unexpected?: string[];
        explanation?: string;
      };
      setState({
        kind: 'fail',
        reason: result.reason,
        ...(details.missing !== undefined ? { missing: details.missing } : {}),
        ...(details.unexpected !== undefined ? { unexpected: details.unexpected } : {}),
        ...(details.explanation !== undefined ? { explanation: details.explanation } : {}),
      });
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
      <div className="space-y-4">
        <ul className="space-y-2">
          {exercise.choices.map((choice) => {
            const checked = selected.includes(choice.id);
            const isCorrectChoice = exercise.correct.includes(choice.id);
            const revealCorrect = state.kind === 'pass' && isCorrectChoice;
            const revealWrong = state.kind === 'fail' && checked && !isCorrectChoice;
            return (
              <motion.li
                key={choice.id}
                animate={revealWrong ? { x: [0, -4, 4, -2, 0] } : { x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <label
                  className={cx(
                    'flex items-start gap-3 rounded-xl border px-3.5 py-2.5 cursor-pointer transition-colors duration-fast',
                    revealCorrect
                      ? 'border-emerald-500/55 bg-emerald-500/10'
                      : revealWrong
                        ? 'border-rose-500/55 bg-rose-500/10'
                        : checked
                          ? 'border-accent/55 bg-accent/10'
                          : 'border-border-base bg-surface/40 hover:border-border-strong hover:bg-surface-2/40',
                  )}
                >
                  <input
                    type={allowMultiple ? 'checkbox' : 'radio'}
                    name={`quiz-${exercise.id}`}
                    checked={checked}
                    onChange={() => toggle(choice.id)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden
                    className={cx(
                      'mt-0.5 grid place-items-center size-5 rounded-full shrink-0 transition-colors duration-fast',
                      revealCorrect
                        ? 'bg-emerald-500 text-white'
                        : revealWrong
                          ? 'bg-rose-500 text-white'
                          : checked
                            ? 'bg-accent text-white'
                            : 'bg-surface-2/80 text-fg-subtle',
                    )}
                  >
                    {revealCorrect ? (
                      <Check size={12} />
                    ) : revealWrong ? (
                      <X size={12} />
                    ) : checked ? (
                      allowMultiple ? (
                        <Check size={12} />
                      ) : (
                        <CheckCircle2 size={14} />
                      )
                    ) : (
                      <Circle size={12} strokeWidth={1.5} />
                    )}
                  </span>
                  <span className="text-[14px] text-fg leading-snug">{choice.text}</span>
                </label>
              </motion.li>
            );
          })}
        </ul>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            disabled={selected.length === 0}
            onClick={handleCheck}
          >
            {t('quiz.check')}
          </Button>
          <HintBlock hints={exercise.hints} />
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {state.kind === 'pass' && (
            <motion.div
              key="pass"
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/8 px-4 py-3 text-[13.5px] text-emerald-700 dark:text-emerald-200 space-y-1"
            >
              <p className="font-medium">{t('quiz.correct')}</p>
              {state.explanation && (
                <p className="text-emerald-700/80 dark:text-emerald-100/80 leading-relaxed">
                  {state.explanation}
                </p>
              )}
            </motion.div>
          )}

          {state.kind === 'fail' && (
            <motion.div
              key="fail"
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              className="rounded-xl border border-rose-500/30 bg-rose-500/8 px-4 py-3 text-[13.5px] text-rose-700 dark:text-rose-200 space-y-1"
            >
              <p className="font-medium">{t('quiz.wrong', { reason: state.reason })}</p>
              {state.explanation && (
                <p className="text-rose-700/80 dark:text-rose-100/80 leading-relaxed">
                  {state.explanation}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ExerciseCard>
  );
};
