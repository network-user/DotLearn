import { describe, expect, it } from 'vitest';

import { formatExpectedActualDiff, formatGoldDetails } from './gold-diff';

describe('formatExpectedActualDiff', () => {
  it('renders expected with - and actual with + markers', () => {
    const diff = formatExpectedActualDiff(
      { label: 'expected', value: 42 },
      { label: 'actual', value: 7 },
    );
    expect(diff).toContain('expected:');
    expect(diff).toContain('- 42');
    expect(diff).toContain('actual:');
    expect(diff).toContain('+ 7');
  });

  it('renders (none) for an empty array side', () => {
    const diff = formatExpectedActualDiff(
      { label: 'expected', value: [] },
      { label: 'actual', value: ['x'] },
    );
    expect(diff).toContain('- (none)');
    expect(diff).toContain('+ "x"');
  });
});

describe('formatGoldDetails', () => {
  it('formats a scalar expected/actual mismatch', () => {
    const out = formatGoldDetails({ expected: 1, actual: 2 });
    expect(out).toContain('- 1');
    expect(out).toContain('+ 2');
  });

  it('formats a row diff with missing and extra rows', () => {
    const out = formatGoldDetails({
      missing: [{ id: 1 }],
      extra: [{ id: 2 }],
    });
    expect(out).toContain('expected rows not produced:');
    expect(out).toContain('- { id: 1 }');
    expect(out).toContain('unexpected rows produced:');
    expect(out).toContain('+ { id: 2 }');
  });

  it('reports a column mismatch in a row diff', () => {
    const out = formatGoldDetails({
      missing: [],
      extra: [],
      expectedColumns: ['id', 'name'],
      actualColumns: ['id'],
    });
    expect(out).toContain('columns:');
    expect(out).toContain('- id, name');
    expect(out).toContain('+ id');
  });

  it('notes an ordering-only mismatch', () => {
    const out = formatGoldDetails({ missing: [], extra: [], misordered: true });
    expect(out).toContain('order differs');
  });

  it('formats case failures for function exercises', () => {
    const out = formatGoldDetails({
      failures: [{ call: 'add(1, 2)', expected: 3, actual: 4 }],
    });
    expect(out).toContain('case "add(1, 2)"');
    expect(out).toContain('- expected 3');
    expect(out).toContain('+ actual   4');
  });

  it('formats a thrown case failure', () => {
    const out = formatGoldDetails({
      failures: [
        { call: 'div(1, 0)', expected: 0, actual: null, thrown: { type: 'ZeroDivisionError', message: 'boom' } },
      ],
    });
    expect(out).toContain('! threw ZeroDivisionError: boom');
  });

  it('returns undefined for unrecognized detail shapes', () => {
    expect(formatGoldDetails(undefined)).toBeUndefined();
    expect(formatGoldDetails(null)).toBeUndefined();
    expect(formatGoldDetails('plain string')).toBeUndefined();
    expect(formatGoldDetails({ unrelated: true })).toBeUndefined();
  });
});
