import { describe, expect, it } from 'vitest';

import { PresenceAnalytics, PresenceBeatInput, PresenceStats } from './presence.schema';

const VALID_ID = '11111111-1111-4111-8111-111111111111';
const VALID_VISITOR = '22222222-2222-4222-8222-222222222222';

describe('PresenceBeatInput', () => {
  it('accepts a valid UUID v4', () => {
    expect(PresenceBeatInput.parse({ id: VALID_ID })).toEqual({ id: VALID_ID });
  });

  it('accepts an optional visitorId and topic slug', () => {
    const payload = { id: VALID_ID, visitorId: VALID_VISITOR, topic: 'db-indexes' };
    expect(PresenceBeatInput.parse(payload)).toEqual(payload);
  });

  it('rejects a non-slug topic', () => {
    expect(PresenceBeatInput.safeParse({ id: VALID_ID, topic: 'Git Basics' }).success).toBe(false);
  });

  it('rejects a visitorId that is not a UUID v4', () => {
    expect(PresenceBeatInput.safeParse({ id: VALID_ID, visitorId: 'nope' }).success).toBe(false);
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
      peakToday: 4,
      series: [{ t: 1_700_000_000_000, online: 2 }],
      daily: [{ day: '2026-01-01', uniques: 5, peak: 3 }],
    };
    expect(PresenceStats.parse(payload)).toEqual(payload);
  });

  it('rejects a payload without peakToday', () => {
    const payload = {
      online: 0,
      uniquesToday: 0,
      series: [],
      daily: [],
    };
    expect(PresenceStats.safeParse(payload).success).toBe(false);
  });

  it('rejects a daily day that is not YYYY-MM-DD', () => {
    const payload = {
      online: 0,
      uniquesToday: 0,
      peakToday: 0,
      series: [],
      daily: [{ day: '01/01/2026', uniques: 0, peak: 0 }],
    };
    expect(PresenceStats.safeParse(payload).success).toBe(false);
  });

  it('accepts the optional extended analytics fields', () => {
    const payload = {
      online: 3,
      uniquesToday: 10,
      peakToday: 5,
      series: [],
      daily: [],
      uniquesAllTime: 1234,
      uniques7d: 300,
      uniques30d: 900,
      peakAllTime: 42,
      totalVisitorDays: 5000,
      reading: [{ topic: 'git', count: 2 }],
    };
    expect(PresenceStats.parse(payload)).toEqual(payload);
  });
});

describe('PresenceAnalytics', () => {
  it('accepts a full analytics payload with per-topic stats', () => {
    const payload = {
      online: 1,
      uniquesToday: 1,
      peakToday: 1,
      series: [],
      daily: [],
      uniquesAllTime: 100,
      uniques7d: 30,
      uniques30d: 90,
      peakAllTime: 9,
      totalVisitorDays: 400,
      reading: [{ topic: 'python', count: 1 }],
      topics: [
        {
          topic: 'python',
          readingNow: 1,
          uniquesAllTime: 50,
          daily: [{ day: '2026-01-01', uniques: 5 }],
        },
      ],
    };
    expect(PresenceAnalytics.parse(payload)).toEqual(payload);
  });

  it('requires the extended fields (unlike PresenceStats)', () => {
    const payload = { online: 1, uniquesToday: 1, peakToday: 1, series: [], daily: [], topics: [] };
    expect(PresenceAnalytics.safeParse(payload).success).toBe(false);
  });
});
