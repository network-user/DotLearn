import type { SqlQueryExercise } from '@dotlearn/contracts';

import { compareRows } from '../compare/rows';
import { compareValues } from '../compare/value';
import { SqlExecutionError, type SqlRuntime } from '../runtime/sql';
import { fail, pass, type RunResult } from './result';

export const runSqlQuery = async (
  exercise: SqlQueryExercise,
  answer: string,
  runtime: SqlRuntime,
): Promise<RunResult> => {
  let execution;
  try {
    execution = await runtime.execute(answer, exercise.fixture);
  } catch (error) {
    if (error instanceof SqlExecutionError) {
      return fail(error.message, { sql: error.sql });
    }
    return fail('sql runtime threw', { message: error instanceof Error ? error.message : String(error) });
  }

  const expected = exercise.expected;
  if (expected.kind === 'result-set') {
    const diff = compareRows(execution.rows, expected.rows, { ordered: expected.ordered });
    if (diff.ok) {
      return pass({ rows: execution.rows, columns: execution.columns });
    }
    return fail('result rows do not match expected', {
      missing: diff.missing,
      extra: diff.extra,
      misordered: diff.misordered,
      expectedColumns: diff.expectedColumns,
      actualColumns: diff.actualColumns,
    });
  }

  const firstRow = execution.rows[0];
  const firstColumn = execution.columns[0];
  const actualValue = firstRow && firstColumn !== undefined ? firstRow[firstColumn] : undefined;
  const cmp = compareValues(actualValue, expected.value);
  if (cmp.ok) {
    return pass({ value: actualValue });
  }
  return fail('scalar mismatch', { expected: expected.value, actual: actualValue });
};
