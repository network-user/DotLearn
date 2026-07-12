import { describe, expect, it } from 'vitest';

import { HyperLogLog, mergedCount } from './hyperloglog';

const within = (estimate: number, actual: number, tolerance: number): boolean =>
  Math.abs(estimate - actual) / actual <= tolerance;

describe('HyperLogLog', () => {
  it('reports zero for an empty sketch', () => {
    const hll = new HyperLogLog(12);
    expect(hll.isEmpty()).toBe(true);
    expect(hll.count()).toBe(0);
  });

  it('estimates small cardinalities near-exactly via linear counting', () => {
    const hll = new HyperLogLog(14);
    for (let i = 0; i < 100; i += 1) hll.add(`id-${i}`);
    expect(within(hll.count(), 100, 0.05)).toBe(true);
  });

  it('estimates large cardinalities within a few percent', () => {
    const hll = new HyperLogLog(14);
    const n = 50_000;
    for (let i = 0; i < n; i += 1) hll.add(`visitor-${i}`);
    expect(within(hll.count(), n, 0.05)).toBe(true);
  });

  it('is idempotent: repeats never change the estimate', () => {
    const hll = new HyperLogLog(12);
    for (let round = 0; round < 5; round += 1) {
      for (let i = 0; i < 500; i += 1) hll.add(`x-${i}`);
    }
    expect(within(hll.count(), 500, 0.06)).toBe(true);
  });

  it('round-trips through base64 without changing the estimate', () => {
    const hll = new HyperLogLog(12);
    for (let i = 0; i < 800; i += 1) hll.add(`r-${i}`);
    const restored = HyperLogLog.fromBase64(12, hll.toBase64());
    expect(restored.count()).toBe(hll.count());
  });

  it('merges sketches into a union cardinality', () => {
    const a = new HyperLogLog(12);
    const b = new HyperLogLog(12);
    for (let i = 0; i < 300; i += 1) a.add(`u-${i}`);
    for (let i = 150; i < 450; i += 1) b.add(`u-${i}`); // overlap 150..299
    // Union spans u-0..u-449 = 450 distinct.
    expect(within(mergedCount([a, b]), 450, 0.06)).toBe(true);
  });

  it('rejects merging mismatched precisions', () => {
    const a = new HyperLogLog(12);
    const b = new HyperLogLog(11);
    expect(() => a.merge(b)).toThrow();
  });

  it('rejects an out-of-range precision', () => {
    expect(() => new HyperLogLog(2)).toThrow();
    expect(() => new HyperLogLog(20)).toThrow();
  });

  it('mergedCount of no sketches is zero', () => {
    expect(mergedCount([])).toBe(0);
  });
});
