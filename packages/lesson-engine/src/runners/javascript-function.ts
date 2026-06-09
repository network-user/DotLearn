import type { JavascriptFunctionExercise } from '@dotlearn/contracts';

import { approximatelyEqual, compareValues } from '../compare/value';
import type { JavascriptRuntime } from '../runtime/javascript';
import { failCoded, pass, type RunResult } from './result';

interface CaseFailure {
  call: string;
  expected: unknown;
  actual: unknown;
  thrown?: { name: string; message: string };
}

export const runJavascriptFunction = async (
  exercise: JavascriptFunctionExercise,
  answer: string,
  runtime: JavascriptRuntime,
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
  return failCoded(
    'cases-failed',
    `${failures.length}/${exercise.cases.length} case(s) failed`,
    { failed: failures.length, total: exercise.cases.length },
    { failures },
  );
};
