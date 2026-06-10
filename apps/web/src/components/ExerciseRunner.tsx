import { useMemo, useState } from 'react';

import { exerciseVariantCount, resolveExerciseVariant, type Exercise } from '@dotlearn/contracts';
import { Shuffle } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';

import { ExerciseCard } from '@/components/sandbox/ExerciseCard';

import { FillInBlanksRunner } from './FillInBlanksRunner';
import { PredictOutputRunner } from './PredictOutputRunner';
import { PythonFunctionRunner } from './PythonFunctionRunner';
import { SqlExerciseRunner } from './SqlExerciseRunner';
import { TheoryQuizRunner } from './TheoryQuizRunner';

interface ExerciseRunnerProps {
  topicSlug: string;
  exercise: Exercise;
}

export const useDifficultyLabel = (difficulty: number): string => {
  const { t } = useTranslation('runners');
  return t(`exercise.difficulty.${difficulty}` as const, {
    defaultValue: t('exercise.difficulty.fallback', { value: difficulty }),
  });
};

const RunnerDispatch = ({ topicSlug, exercise }: ExerciseRunnerProps) => {
  if (exercise.type === 'sql-query') {
    return <SqlExerciseRunner topicSlug={topicSlug} exercise={exercise} />;
  }
  if (exercise.type === 'theory-quiz') {
    return <TheoryQuizRunner topicSlug={topicSlug} exercise={exercise} />;
  }
  if (exercise.type === 'predict-output') {
    return <PredictOutputRunner topicSlug={topicSlug} exercise={exercise} />;
  }
  if (exercise.type === 'fill-in-blanks') {
    return <FillInBlanksRunner topicSlug={topicSlug} exercise={exercise} />;
  }
  if (exercise.type === 'python-function') {
    return <PythonFunctionRunner topicSlug={topicSlug} exercise={exercise} />;
  }
  return (
    <UnknownRunner type={exercise.type} difficulty={exercise.difficulty} prompt={exercise.prompt} />
  );
};

export const ExerciseRunner = ({ topicSlug, exercise }: ExerciseRunnerProps) => {
  const { t } = useTranslation('runners');
  const variantTotal = exerciseVariantCount(exercise);
  const [variantIndex, setVariantIndex] = useState(() =>
    Math.floor(Math.random() * variantTotal),
  );
  const resolved = useMemo(
    () => resolveExerciseVariant(exercise, variantIndex),
    [exercise, variantIndex],
  );

  if (variantTotal <= 1) {
    return <RunnerDispatch topicSlug={topicSlug} exercise={resolved} />;
  }

  const pickAnotherVariant = (): void => {
    setVariantIndex(
      (current) => (current + 1 + Math.floor(Math.random() * (variantTotal - 1))) % variantTotal,
    );
  };

  return (
    <div>
      <div className="flex items-center justify-end gap-2.5 mb-1.5">
        <span className="eyebrow text-[10px]">
          {t('exercise.variantLabel', {
            current: variantIndex + 1,
            total: variantTotal,
            defaultValue: 'вариант {{current}}/{{total}}',
          })}
        </span>
        <button
          type="button"
          onClick={pickAnotherVariant}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline underline-offset-2 min-h-[var(--tap)] sm:min-h-0"
        >
          <Shuffle size={11} />
          {t('exercise.anotherVariant', { defaultValue: 'другой вариант' })}
        </button>
      </div>
      <RunnerDispatch key={variantIndex} topicSlug={topicSlug} exercise={resolved} />
    </div>
  );
};

const UnknownRunner = ({
  type,
  difficulty,
  prompt,
}: {
  type: string;
  difficulty: number;
  prompt: string;
}) => {
  const label = useDifficultyLabel(difficulty);
  return (
    <ExerciseCard type={type} prompt={prompt} difficultyLabel={label} status="idle">
      <p className="text-sm text-fg-subtle italic">
        <Trans
          i18nKey="runners:exercise.noRunner"
          values={{ type }}
          components={{ code: <code /> }}
        />
      </p>
    </ExerciseCard>
  );
};
