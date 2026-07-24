import { normalizeCodeish } from './normalize';

export type ValueComparison =
  | { ok: true }
  | { ok: false; reason: 'type' | 'value' | 'length' | 'key'; path: string };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  !(value instanceof Set) &&
  !(value instanceof Map) &&
  !(value instanceof Date);

const NUMERIC_STRING = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;

const asFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed !== '' && NUMERIC_STRING.test(trimmed)) {
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
};

export const compareValues = (actual: unknown, expected: unknown, path = '$'): ValueComparison => {
  if (
    typeof actual === 'number' &&
    typeof expected === 'number' &&
    Number.isNaN(actual) &&
    Number.isNaN(expected)
  ) {
    return { ok: true };
  }
  // Python None becomes JS undefined, while a YAML `null` expectation loads as JS null.
  // Both denote "no value", so treat them as equal.
  if ((actual === null || actual === undefined) && (expected === null || expected === undefined)) {
    return { ok: true };
  }
  if (actual === expected) {
    return { ok: true };
  }
  // SQL cells and predict grids often mix YAML numbers with sql.js numbers, but a
  // TEXT column or a typed answer field can surface the same magnitude as a string.
  // Same finite number written two ways should not fail the learner.
  const actualNumber = asFiniteNumber(actual);
  const expectedNumber = asFiniteNumber(expected);
  if (
    actualNumber !== undefined &&
    expectedNumber !== undefined &&
    (typeof actual === 'number' || typeof expected === 'number')
  ) {
    return actualNumber === expectedNumber ? { ok: true } : { ok: false, reason: 'value', path };
  }
  // Quote style and structural spacing should not decide correctness for code-ish
  // string answers (python/js return values, predict scalars, SQL cells). Case and
  // line breaks stay significant because normalizeCodeish preserves them.
  if (
    typeof actual === 'string' &&
    typeof expected === 'string' &&
    normalizeCodeish(actual) === normalizeCodeish(expected)
  ) {
    return { ok: true };
  }
  if (actual instanceof Set && expected instanceof Set) {
    if (actual.size !== expected.size) {
      return { ok: false, reason: 'length', path };
    }
    const expectedItems = [...expected];
    const used = new Set<number>();
    for (const item of actual) {
      const matchIndex = expectedItems.findIndex(
        (candidate, index) => !used.has(index) && compareValues(item, candidate, path).ok,
      );
      if (matchIndex < 0) {
        return { ok: false, reason: 'value', path };
      }
      used.add(matchIndex);
    }
    return { ok: true };
  }
  if (actual instanceof Map && expected instanceof Map) {
    if (actual.size !== expected.size) {
      return { ok: false, reason: 'length', path };
    }
    for (const [key, value] of actual) {
      if (!expected.has(key)) {
        return { ok: false, reason: 'key', path: `${path}.${String(key)}` };
      }
      const inner = compareValues(value, expected.get(key), `${path}.${String(key)}`);
      if (!inner.ok) {
        return inner;
      }
    }
    return { ok: true };
  }
  if (typeof actual !== typeof expected) {
    return { ok: false, reason: 'type', path };
  }
  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) {
      return { ok: false, reason: 'length', path };
    }
    for (let index = 0; index < actual.length; index += 1) {
      const inner = compareValues(actual[index], expected[index], `${path}[${index}]`);
      if (!inner.ok) {
        return inner;
      }
    }
    return { ok: true };
  }
  if (isPlainObject(actual) && isPlainObject(expected)) {
    const keys = new Set([...Object.keys(actual), ...Object.keys(expected)]);
    for (const key of keys) {
      if (!(key in actual) || !(key in expected)) {
        return { ok: false, reason: 'key', path: `${path}.${key}` };
      }
      const inner = compareValues(actual[key], expected[key], `${path}.${key}`);
      if (!inner.ok) {
        return inner;
      }
    }
    return { ok: true };
  }
  return { ok: false, reason: 'value', path };
};

export const approximatelyEqual = (actual: unknown, expected: number, epsilon = 1e-6): boolean =>
  typeof actual === 'number' && Math.abs(actual - expected) <= epsilon;
