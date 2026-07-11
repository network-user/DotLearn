import { normalizeCodeish } from './normalize';

export type ValueComparison =
  | { ok: true }
  | { ok: false; reason: 'type' | 'value' | 'length' | 'key'; path: string };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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
