import { describe, expect, it } from 'vitest';

import { standTierOf } from './stand-layout';

describe('standTierOf', () => {
  it('keeps a phone and a lesson column from opening the full side panels', () => {
    expect(standTierOf(375)).toBe('compact');
    expect(standTierOf(599)).toBe('compact');
    expect(standTierOf(632)).toBe('medium');
    expect(standTierOf(959)).toBe('medium');
    expect(standTierOf(1192)).toBe('wide');
  });

  it('accepts a wider sidebar threshold for a single-column shell', () => {
    expect(standTierOf(700, 760, 1040)).toBe('compact');
    expect(standTierOf(800, 760, 1040)).toBe('medium');
    expect(standTierOf(1100, 760, 1040)).toBe('wide');
  });
});
