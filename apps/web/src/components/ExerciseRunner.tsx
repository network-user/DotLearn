import type { Exercise } from '@dotlearn/contracts';
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

export const ExerciseRunner = ({ topicSlug, exercise }: ExerciseRunnerProps) => {
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
  return <UnknownRunner type={exercise.type} difficulty={exercise.difficulty} prompt={exercise.prompt} />;
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
