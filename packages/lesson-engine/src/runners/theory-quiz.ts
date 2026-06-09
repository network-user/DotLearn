import type { TheoryQuizExercise } from '@dotlearn/contracts';

import { fail, pass, type RunResult } from './result';

export const runTheoryQuiz = (exercise: TheoryQuizExercise, answer: string[]): RunResult => {
  if (!Array.isArray(answer)) {
    return fail('expected array of choice ids');
  }
  const expected = new Set(exercise.correct);
  const given = new Set(answer);
  const missing: string[] = [];
  const unexpected: string[] = [];
  for (const id of expected) {
    if (!given.has(id)) {
      missing.push(id);
    }
  }
  for (const id of given) {
    if (!expected.has(id)) {
      unexpected.push(id);
    }
  }
  if (missing.length === 0 && unexpected.length === 0) {
    return pass(exercise.explanation ? { explanation: exercise.explanation } : undefined);
  }
  return fail('incorrect choice set', { missing, unexpected, explanation: exercise.explanation });
};
