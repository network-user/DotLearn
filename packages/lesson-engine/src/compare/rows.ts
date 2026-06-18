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

const canonicalKey = (row: Row): string => {
  const keys = Object.keys(row).sort();
  return JSON.stringify(keys.map((key) => [key, row[key]]));
};

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
      const cmp = compareValues(left, right);
      if (!cmp.ok) {
        missing.push(right);
        extra.push(left);
        ok = false;
      }
    }
    return { ok, missing, extra, misordered: false, expectedColumns, actualColumns };
  }

  const actualKeys: string[] = [];
  const actualCounts = new Map<string, { row: Row; count: number }>();
  for (const row of actual) {
    const key = canonicalKey(row);
    actualKeys.push(key);
    const entry = actualCounts.get(key);
    if (entry) {
      entry.count += 1;
    } else {
      actualCounts.set(key, { row, count: 1 });
    }
  }
  const expectedKeys: string[] = [];
  const missing: Row[] = [];
  for (const row of expected) {
    const key = canonicalKey(row);
    expectedKeys.push(key);
    const entry = actualCounts.get(key);
    if (!entry || entry.count === 0) {
      missing.push(row);
    } else {
      entry.count -= 1;
    }
  }
  const extra: Row[] = [];
  for (const { row, count } of actualCounts.values()) {
    for (let index = 0; index < count; index += 1) {
      extra.push(row);
    }
  }
  const ok = missing.length === 0 && extra.length === 0;
  const misordered = ok && actualKeys.some((key, index) => key !== expectedKeys[index]);
  return { ok, missing, extra, misordered, expectedColumns, actualColumns };
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
