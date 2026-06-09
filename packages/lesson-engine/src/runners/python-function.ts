import type { PythonFunctionExercise } from '@dotlearn/contracts';

import { approximatelyEqual, compareValues } from '../compare/value';
import type { PythonRuntime } from '../runtime/python';
import { fail, pass, type RunResult } from './result';

interface CaseFailure {
  call: string;
  expected: unknown;
  actual: unknown;
  thrown?: { type: string; message: string };
}

export const runPythonFunction = async (
  exercise: PythonFunctionExercise,
  answer: string,
  runtime: PythonRuntime,
): Promise<RunResult> => {
  const failures: CaseFailure[] = [];
  for (const testCase of exercise.cases) {
    const execution = await runtime.evaluate(answer, testCase.call);
    if (execution.thrown) {
      failures.push({
        call: testCase.call,
        expected: testCase.expect ?? testCase.expect_approx,
        actual: undefined,
        thrown: execution.thrown,
      });
      continue;
    }
    const matched =
      testCase.expect_approx !== undefined
        ? approximatelyEqual(execution.result, testCase.expect_approx)
        : compareValues(execution.result, testCase.expect).ok;
    if (!matched) {
      failures.push({
        call: testCase.call,
        expected: testCase.expect ?? testCase.expect_approx,
        actual: execution.result,
      });
    }
  }
  if (failures.length === 0) {
    return pass({ casesPassed: exercise.cases.length });
  }
  return fail(`${failures.length}/${exercise.cases.length} case(s) failed`, { failures });
};
