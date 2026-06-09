import type { PredictOutputExercise } from '@dotlearn/contracts';

import { compareRows } from '../compare/rows';
import { compareValues } from '../compare/value';
import { fail, pass, type RunResult } from './result';

export const runPredictOutput = (
  exercise: PredictOutputExercise,
  answer: unknown,
): RunResult => {
  const expected = exercise.expected;
  if (expected.kind === 'scalar') {
    const cmp = compareValues(answer, expected.value);
    return cmp.ok ? pass({ value: answer }) : fail('predicted value differs', {
      expected: expected.value,
      actual: answer,
      path: cmp.path,
    });
  }
  if (expected.kind === 'stdout') {
    if (typeof answer !== 'string') {
      return fail('expected stdout to be a string', { actual: answer });
    }
    return answer === expected.value
      ? pass({ stdout: answer })
      : fail('predicted stdout differs', { expected: expected.value, actual: answer });
  }
  if (!Array.isArray(answer)) {
    return fail('expected predicted output to be an array of rows', { actual: answer });
  }
  const diff = compareRows(answer as Record<string, unknown>[], expected.rows, {
    ordered: expected.ordered,
  });
  return diff.ok
    ? pass({ rows: answer })
    : fail('predicted rows do not match expected', {
        missing: diff.missing,
        extra: diff.extra,
        misordered: diff.misordered,
      });
};
