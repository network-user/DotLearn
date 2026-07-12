import { beforeEach, describe, expect, it, vi } from 'vitest';

import { db, localDayKey, recordAttempt, recordCheckpointResult } from './progress-db';

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('localDayKey', () => {
  it('formats a date as a zero-padded local YYYY-MM-DD key', () => {
    expect(localDayKey(new Date(2026, 0, 5, 13, 30))).toBe('2026-01-05');
  });

  it('pads two-digit months and days', () => {
    expect(localDayKey(new Date(2026, 10, 9, 0, 0))).toBe('2026-11-09');
  });

  it('uses local components rather than UTC', () => {
    const date = new Date(2026, 5, 20, 23, 59);
    expect(localDayKey(date)).toBe('2026-06-20');
  });
});

describe('recordAttempt', () => {
  it('creates a progress row with a single attempt on first call', async () => {
    await recordAttempt('fastapi', 'ex1', 'fail');

    const record = await db.progress.get('fastapi:ex1');
    expect(record?.attempts).toBe(1);
    expect(record?.status).toBe('fail');
  });

  it('increments attempts on repeated calls', async () => {
    await recordAttempt('fastapi', 'ex1', 'fail');
    await recordAttempt('fastapi', 'ex1', 'fail');
    await recordAttempt('fastapi', 'ex1', 'pass');

    const record = await db.progress.get('fastapi:ex1');
    expect(record?.attempts).toBe(3);
    expect(record?.status).toBe('pass');
  });

  it('keeps a pass sticky once achieved', async () => {
    await recordAttempt('fastapi', 'ex1', 'pass');
    await recordAttempt('fastapi', 'ex1', 'fail');

    const record = await db.progress.get('fastapi:ex1');
    expect(record?.attempts).toBe(2);
    expect(record?.status).toBe('pass');
  });

  it('writes one attempt event per call', async () => {
    await recordAttempt('fastapi', 'ex1', 'fail');
    await recordAttempt('fastapi', 'ex1', 'pass');

    expect(await db.attemptEvents.count()).toBe(2);
  });
});

describe('recordCheckpointResult pruning', () => {
  it('prunes checkpointResults down to the cap once writes overflow it', async () => {
    const seed = Array.from({ length: 4001 }, (_, i) => ({
      topicSlug: 't',
      conceptId: `c${i}`,
      status: 'pass' as const,
      at: new Date(Date.UTC(2026, 0, 1) + i * 1000).toISOString(),
    }));
    await db.checkpointResults.bulkAdd(seed);
    expect(await db.checkpointResults.count()).toBe(4001);

    await recordCheckpointResult({ topicSlug: 't', conceptId: 'latest', status: 'pass' });

    await vi.waitFor(async () => {
      expect(await db.checkpointResults.count()).toBe(4000);
    });
  });
});
