import { useState } from 'react';

import type { TheoryQuizExercise } from '@dotlearn/contracts';
import { runTheoryQuiz } from '@dotlearn/lesson-engine';
import { AnimatePresence, m as motion } from 'framer-motion';
import { Check, CheckCircle2, Circle, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { ExerciseCard, type ExerciseCardStatus } from '@/components/sandbox/ExerciseCard';
import { HintBlock } from '@/components/sandbox/HintBlock';
import { Button } from '@/components/ui/Button';
import { ConfidenceSelector } from '@/components/ui/ConfidenceSelector';
import { burstConfetti } from '@/components/ui/confetti';
import { cx } from '@/components/ui/cx';
import { extractFailureReason, useFailureMessage, type FailureReason } from '@/lib/failure-reason';
import { recordAttempt, type ConfidenceLevel } from '@/lib/progress-db';

import { useDifficultyLabel } from './ExerciseRunner';

interface TheoryQuizRunnerProps {
  topicSlug: string;
  exercise: TheoryQuizExercise;
  conceptId?: string | undefined;
}

const shuffleArray = <T,>(items: readonly T[]): T[] => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const held = result[index];
    const swapped = result[swapIndex];
    if (held === undefined || swapped === undefined) continue;
    result[index] = swapped;
    result[swapIndex] = held;
  }
  return result;
};

type CheckState =
  | { kind: 'idle' }
  | { kind: 'pass'; explanation?: string }
  | {
      kind: 'fail';
      failure: FailureReason;
      missing?: string[];
      unexpected?: string[];
      explanation?: string;
    };

export const TheoryQuizRunner = ({ topicSlug, exercise, conceptId }: TheoryQuizRunnerProps) => {
  const { t } = useTranslation('runners');
  const difficultyLabel = useDifficultyLabel(exercise.difficulty);
  const failureMessage = useFailureMessage();
  const allowMultiple = exercise.correct.length > 1;
  const [shuffledChoices] = useState(() => shuffleArray(exercise.choices));
  const [selected, setSelected] = useState<string[]>([]);
  const [state, setState] = useState<CheckState>({ kind: 'idle' });
  const [confidence, setConfidence] = useState<ConfidenceLevel | null>(null);
  const [pulse, setPulse] = useState(0);

  const toggle = (id: string): void => {
    setSelected((prev) => {
      if (allowMultiple) {
        return prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id];
      }
      return [id];
    });
    setState({ kind: 'idle' });
    setConfidence(null);
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
      void recordAttempt(topicSlug, exercise.id, 'pass', {
        difficulty: exercise.difficulty,
        concept: conceptId,
        ...(confidence !== null ? { confidence } : {}),
      });
    } else {
      const details = (result.details ?? {}) as {
        missing?: string[];
        unexpected?: string[];
        explanation?: string;
      };
      setState({
        kind: 'fail',
        failure: extractFailureReason(result),
        ...(details.missing !== undefined ? { missing: details.missing } : {}),
        ...(details.unexpected !== undefined ? { unexpected: details.unexpected } : {}),
        ...(details.explanation !== undefined ? { explanation: details.explanation } : {}),
      });
      void recordAttempt(topicSlug, exercise.id, 'fail', {
        difficulty: exercise.difficulty,
        concept: conceptId,
        ...(confidence !== null ? { confidence } : {}),
      });
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
          {shuffledChoices.map((choice) => {
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
                    'flex items-start gap-3 rounded-lg border px-3.5 py-2.5 min-h-[var(--tap)] cursor-pointer transition-colors duration-fast',
                    revealCorrect
                      ? 'border-ok/55 bg-ok/10'
                      : revealWrong
                        ? 'border-err/55 bg-err/10'
                        : checked
                          ? 'border-accent/55 bg-accent/10'
                          : 'border-border-base bg-surface hover:border-border-strong hover:bg-surface-2/50',
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
                        ? 'bg-ok text-surface dark:text-canvas'
                        : revealWrong
                          ? 'bg-err text-surface dark:text-canvas'
                          : checked
                            ? 'bg-accent text-surface dark:text-canvas'
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
                  <span className="text-[15px] text-fg leading-relaxed">{choice.text}</span>
                </label>
              </motion.li>
            );
          })}
        </ul>

        <ConfidenceSelector value={confidence} onChange={setConfidence} />

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="primary"
            size="sm"
            disabled={selected.length === 0}
            onClick={handleCheck}
            className="h-11 flex-1 sm:flex-initial sm:h-8"
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
              className="rounded-lg border border-ok/30 bg-ok/8 px-4 py-3 text-[13.5px] text-ok space-y-1"
            >
              <p className="font-medium">{t('quiz.correct')}</p>
              {state.explanation && (
                <p className="text-ok/80 leading-relaxed">{state.explanation}</p>
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
              className="rounded-lg border border-err/30 bg-err/8 px-4 py-3 text-[13.5px] text-err space-y-1"
            >
              <p className="font-medium">
                {t('quiz.wrong', { reason: failureMessage(state.failure) })}
              </p>
              {state.explanation && (
                <p className="text-err/80 leading-relaxed">{state.explanation}</p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ExerciseCard>
  );
};
