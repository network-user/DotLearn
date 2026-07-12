/**
 * Tiny dependency-free HyperLogLog for anonymous cardinality estimation.
 *
 * Used to count unique visitors "all time" (and per topic) from a stable but
 * anonymous device id, without ever storing the ids themselves: only a fixed
 * array of small registers is kept. Memory is bounded by the precision `p`
 * (2^p bytes) regardless of how many ids are seen, so a busy site cannot grow
 * this without limit — which is exactly what the deploy target needs.
 *
 * Classic Flajolet et al. estimator with the standard small-range (linear
 * counting) and 32-bit large-range corrections. A 32-bit hash is plenty for a
 * learning site; at the cardinalities involved the error is ~1.04/sqrt(2^p).
 */

// FNV-1a (32-bit) followed by a murmur3 finalizer for avalanche. Deterministic,
// no allocations, good enough distribution for HLL bucketing.
const hash32 = (value: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
};

const MIN_P = 4;
const MAX_P = 16;

const alphaFor = (m: number): number => {
  if (m === 16) return 0.673;
  if (m === 32) return 0.697;
  if (m === 64) return 0.709;
  return 0.7213 / (1 + 1.079 / m);
};

export class HyperLogLog {
  readonly p: number;
  readonly m: number;
  private readonly registers: Uint8Array;

  constructor(p = 12, registers?: Uint8Array) {
    if (!Number.isInteger(p) || p < MIN_P || p > MAX_P) {
      throw new Error(`HyperLogLog precision p must be an integer in [${MIN_P}, ${MAX_P}]`);
    }
    this.p = p;
    this.m = 1 << p;
    this.registers = registers && registers.length === this.m ? registers : new Uint8Array(this.m);
  }

  /** Observe an id. Idempotent for repeats: adding the same value never lowers a register. */
  add(value: string): void {
    const h = hash32(value);
    const index = h >>> (32 - this.p); // top p bits pick the register
    // Remaining (32 - p) bits, left-aligned; rho = position of the leftmost set bit.
    const w = (h << this.p) >>> 0;
    const rho = w === 0 ? 32 - this.p + 1 : Math.clz32(w) + 1;
    if (rho > this.registers[index]!) {
      this.registers[index] = rho;
    }
  }

  /** Estimated number of distinct values observed. */
  count(): number {
    const m = this.m;
    let sum = 0;
    let zeros = 0;
    for (let i = 0; i < m; i += 1) {
      const value = this.registers[i]!;
      sum += 2 ** -value;
      if (value === 0) zeros += 1;
    }
    let estimate = (alphaFor(m) * m * m) / sum;
    if (estimate <= 2.5 * m && zeros > 0) {
      // Small range: linear counting is far more accurate than the raw estimator.
      estimate = m * Math.log(m / zeros);
    } else if (estimate > (1 / 30) * 2 ** 32) {
      // Large range: undo the collision saturation of a 32-bit hash space.
      estimate = -(2 ** 32) * Math.log(1 - estimate / 2 ** 32);
    }
    return Math.round(estimate);
  }

  /** Fold another sketch of the same precision into this one (register-wise max). */
  merge(other: HyperLogLog): void {
    if (other.p !== this.p) {
      throw new Error('cannot merge HyperLogLog sketches of different precision');
    }
    const src = other.registers;
    for (let i = 0; i < this.m; i += 1) {
      if (src[i]! > this.registers[i]!) this.registers[i] = src[i]!;
    }
  }

  isEmpty(): boolean {
    return this.registers.every((value) => value === 0);
  }

  toBase64(): string {
    return Buffer.from(this.registers).toString('base64');
  }

  static fromBase64(p: number, base64: string): HyperLogLog {
    const bytes = new Uint8Array(Buffer.from(base64, 'base64'));
    return new HyperLogLog(p, bytes);
  }
}

/** Estimate the cardinality of the union of several equal-precision sketches. */
export const mergedCount = (sketches: HyperLogLog[]): number => {
  if (sketches.length === 0) return 0;
  const first = sketches[0]!;
  const union = new HyperLogLog(first.p);
  for (const sketch of sketches) union.merge(sketch);
  return union.count();
};
