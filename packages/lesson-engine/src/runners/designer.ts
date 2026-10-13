import { DesignerCommand, type DesignerExercise } from '@dotlearn/contracts';

import { DesignerCommandError, gradeDesignerSession } from '../runtime/designer';
import { failCoded, pass, type RunResult } from './result';

export const runDesigner = (exercise: DesignerExercise, answer: unknown): RunResult => {
  const parsed = DesignerCommand.array().safeParse(answer);
  if (!parsed.success) {
    return failCoded('invalid-answer', 'expected designer commands as an array');
  }
  try {
    const grade = gradeDesignerSession(exercise, parsed.data);
    if (grade.ok) return pass(grade);
    const steps = grade.steps.filter((step) => !step.ok).length;
    const goals = grade.goals.filter((goal) => !goal.ok).length;
    return failCoded('onec-check-unmet', 'lab checks are not satisfied', { steps, goals }, grade);
  } catch (error) {
    if (error instanceof DesignerCommandError) {
      return failCoded('onec-command-error', error.message, { message: error.message });
    }
    throw error;
  }
};
