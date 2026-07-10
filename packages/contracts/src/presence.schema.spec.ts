import { describe, expect, it } from 'vitest';

import { PresenceBeatInput, PresenceStats } from './presence.schema';

const VALID_ID = '11111111-1111-4111-8111-111111111111';

describe('PresenceBeatInput', () => {
  it('accepts a valid UUID v4', () => {
    expect(PresenceBeatInput.parse({ id: VALID_ID })).toEqual({ id: VALID_ID });
  });

  it('rejects a non-UUID string', () => {
    expect(PresenceBeatInput.safeParse({ id: 'nope' }).success).toBe(false);
  });

  it('rejects a UUID that is not version 4', () => {
    expect(
      PresenceBeatInput.safeParse({ id: '11111111-1111-1111-8111-111111111111' }).success,
    ).toBe(false);
  });

  it('rejects unknown keys (strict)', () => {
    expect(PresenceBeatInput.safeParse({ id: VALID_ID, extra: 1 }).success).toBe(false);
  });
});

describe('PresenceStats', () => {
  it('accepts a well-formed stats payload', () => {
    const payload = {
      online: 2,
      uniquesToday: 5,
      series: [{ t: 1_700_000_000_000, online: 2 }],
      daily: [{ day: '2026-01-01', uniques: 5, peak: 3 }],
    };
    expect(PresenceStats.parse(payload)).toEqual(payload);
  });

  it('rejects a daily day that is not YYYY-MM-DD', () => {
    const payload = {
      online: 0,
      uniquesToday: 0,
      series: [],
      daily: [{ day: '01/01/2026', uniques: 0, peak: 0 }],
    };
    expect(PresenceStats.safeParse(payload).success).toBe(false);
  });
});
