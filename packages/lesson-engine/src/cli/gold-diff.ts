const stableStringify = (value: unknown): string => {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(', ')}]`;
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${key}: ${stableStringify(entry)}`);
    return `{ ${entries.join(', ')} }`;
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  return String(value);
};

const toLines = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.length === 0 ? ['(none)'] : value.map(stableStringify);
  }
  return [stableStringify(value)];
};

export interface DiffSide {
  label: string;
  value: unknown;
}

export const formatExpectedActualDiff = (expected: DiffSide, actual: DiffSide): string => {
  const expectedLines = toLines(expected.value);
  const actualLines = toLines(actual.value);
  const lines: string[] = [];
  lines.push(`      ${expected.label}:`);
  for (const line of expectedLines) {
    lines.push(`      - ${line}`);
  }
  lines.push(`      ${actual.label}:`);
  for (const line of actualLines) {
    lines.push(`      + ${line}`);
  }
  return lines.join('\n');
};

interface RowDiffDetails {
  missing?: unknown[];
  extra?: unknown[];
  misordered?: boolean;
  expectedColumns?: string[];
  actualColumns?: string[];
}

interface ScalarDiffDetails {
  expected?: unknown;
  actual?: unknown;
}

interface CaseFailureDetails {
  failures?: Array<{
    call: string;
    expected: unknown;
    actual: unknown;
    thrown?: { type: string; message: string };
  }>;
}

const isRowDiff = (details: Record<string, unknown>): boolean =>
  'missing' in details || 'extra' in details || 'misordered' in details;

const isScalarDiff = (details: Record<string, unknown>): boolean =>
  'expected' in details && 'actual' in details && !('failures' in details);

const isCaseFailures = (details: Record<string, unknown>): boolean => 'failures' in details;

const formatRowDiff = (details: RowDiffDetails): string => {
  const lines: string[] = [];
  if (details.expectedColumns && details.actualColumns) {
    const expectedColumns = details.expectedColumns.join(', ');
    const actualColumns = details.actualColumns.join(', ');
    if (expectedColumns !== actualColumns) {
      lines.push(`      columns:`);
      lines.push(`      - ${expectedColumns}`);
      lines.push(`      + ${actualColumns}`);
    }
  }
  const missing = details.missing ?? [];
  const extra = details.extra ?? [];
  if (missing.length > 0) {
    lines.push(`      expected rows not produced:`);
    for (const row of missing) {
      lines.push(`      - ${stableStringify(row)}`);
    }
  }
  if (extra.length > 0) {
    lines.push(`      unexpected rows produced:`);
    for (const row of extra) {
      lines.push(`      + ${stableStringify(row)}`);
    }
  }
  if (lines.length === 0 && details.misordered) {
    lines.push('      rows match but order differs (set ordered: false or add ORDER BY)');
  }
  return lines.join('\n');
};

const formatCaseFailures = (details: CaseFailureDetails): string => {
  const failures = details.failures ?? [];
  return failures
    .map((failure) => {
      const head = `      case ${JSON.stringify(failure.call)}:`;
      if (failure.thrown) {
        return `${head}\n      ! threw ${failure.thrown.type}: ${failure.thrown.message}`;
      }
      return `${head}\n      - expected ${stableStringify(
        failure.expected,
      )}\n      + actual   ${stableStringify(failure.actual)}`;
    })
    .join('\n');
};

export const formatGoldDetails = (details: unknown): string | undefined => {
  if (details === null || details === undefined || typeof details !== 'object') {
    return undefined;
  }
  const record = details as Record<string, unknown>;
  if (isCaseFailures(record)) {
    return formatCaseFailures(record as CaseFailureDetails);
  }
  if (isRowDiff(record)) {
    return formatRowDiff(record as RowDiffDetails);
  }
  if (isScalarDiff(record)) {
    const scalar = record as ScalarDiffDetails;
    return formatExpectedActualDiff(
      { label: 'expected', value: scalar.expected },
      { label: 'actual', value: scalar.actual },
    );
  }
  return undefined;
};
