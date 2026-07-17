import { compareValues } from './value';

export type Row = Record<string, unknown>;

export interface RowDiff {
  ok: boolean;
  missing: Row[];
  extra: Row[];
  misordered: boolean;
  expectedColumns: string[];
  actualColumns: string[];
}

const collectColumns = (rows: Row[]): string[] => {
  const columns: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    }
  }
  return columns;
};

const rowsEqual = (left: Row, right: Row): boolean => compareValues(left, right).ok;

export const compareRows = (
  actual: Row[],
  expected: Row[],
  options: { ordered?: boolean } = {},
): RowDiff => {
  const expectedColumns = collectColumns(expected);
  const actualColumns = collectColumns(actual);

  if (options.ordered) {
    const missing: Row[] = [];
    const extra: Row[] = [];
    let ok = true;
    const length = Math.max(actual.length, expected.length);
    for (let index = 0; index < length; index += 1) {
      const left = actual[index];
      const right = expected[index];
      if (left === undefined) {
        missing.push(right as Row);
        ok = false;
        continue;
      }
      if (right === undefined) {
        extra.push(left);
        ok = false;
        continue;
      }
      if (!rowsEqual(left, right)) {
        missing.push(right);
        extra.push(left);
        ok = false;
      }
    }
    return { ok, missing, extra, misordered: false, expectedColumns, actualColumns };
  }

  const unmatchedActual = actual.map((row) => ({ row, used: false }));
  const missing: Row[] = [];

  for (const expectedRow of expected) {
    const matchIndex = unmatchedActual.findIndex(
      (entry) => !entry.used && rowsEqual(entry.row, expectedRow),
    );
    if (matchIndex < 0) {
      missing.push(expectedRow);
      continue;
    }
    const entry = unmatchedActual[matchIndex];
    if (entry) {
      entry.used = true;
    }
  }

  const extra: Row[] = unmatchedActual.filter((entry) => !entry.used).map((entry) => entry.row);
  const ok = missing.length === 0 && extra.length === 0;
  const positionallyEqual =
    ok &&
    actual.length === expected.length &&
    actual.every((row, index) => rowsEqual(row, expected[index]!));

  return {
    ok,
    missing,
    extra,
    misordered: ok && !positionallyEqual,
    expectedColumns,
    actualColumns,
  };
};

export const formatRowDiff = (diff: RowDiff): string => {
  if (diff.ok) {
    return diff.misordered ? 'rows match but order differs' : 'rows match';
  }
  const parts: string[] = [];
  if (diff.missing.length > 0) {
    parts.push(`${diff.missing.length} missing row(s): ${JSON.stringify(diff.missing)}`);
  }
  if (diff.extra.length > 0) {
    parts.push(`${diff.extra.length} extra row(s): ${JSON.stringify(diff.extra)}`);
  }
  return parts.join('; ');
};
