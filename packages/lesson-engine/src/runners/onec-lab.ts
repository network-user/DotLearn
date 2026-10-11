import { OnecCommand, type OnecLabExercise } from '@dotlearn/contracts';

import { gradeOnecSession, OnecCommandError } from '../runtime/onec';
import { failCoded, pass, type RunResult } from './result';

export const runOnecLab = (exercise: OnecLabExercise, answer: unknown): RunResult => {
  const parsed = OnecCommand.array().safeParse(answer);
  if (!parsed.success) {
    return failCoded('invalid-answer', 'expected onec commands as an array');
  }
  try {
    const grade = gradeOnecSession(exercise, parsed.data);
    if (grade.ok) {
      return pass(grade);
    }
    const steps = grade.steps.filter((step) => !step.ok).length;
    const goals = grade.goals.filter((goal) => !goal.ok).length;
    return failCoded('onec-check-unmet', 'lab checks are not satisfied', { steps, goals }, grade);
  } catch (error) {
    if (error instanceof OnecCommandError) {
      return failCoded('onec-command-error', error.message, { message: error.message });
    }
    throw error;
  }
};
