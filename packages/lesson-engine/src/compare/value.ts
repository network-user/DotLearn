export type ValueComparison =
  | { ok: true }
  | { ok: false; reason: 'type' | 'value' | 'length' | 'key'; path: string };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const compareValues = (actual: unknown, expected: unknown, path = '$'): ValueComparison => {
  if (Number.isNaN(actual as number) && Number.isNaN(expected as number)) {
    return { ok: true };
  }
  if (actual === expected) {
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
