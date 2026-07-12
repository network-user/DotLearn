import { beforeEach, describe, expect, it, vi } from 'vitest';

import { pushSync } from '../api-client';
import {
  db,
  type AttemptEventRecord,
  type CheckpointResultRecord,
  type ProgressRecord,
} from '../progress-db';
import type { ProgressExport } from '../progress-io';

import { __test } from './engine';
import type { SyncSnapshot } from './merge';

vi.mock('../api-client', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return { ...actual, pullSync: vi.fn(), pushSync: vi.fn() };
});

const EMPTY_DATA: ProgressExport['data'] = {
  progress: [],
  activity: [],
  flashcardReviews: [],
  interviewStudied: [],
  topicPlace: [],
  conceptNotes: [],
  bookmarks: [],
  conceptRead: [],
  conceptScroll: [],
  highlights: [],
  attemptEvents: [],
  achievements: [],
  checkpointResults: [],
  examResults: [],
  userCards: [],
  reExamSchedule: [],
};

const snapshot = (data: Partial<ProgressExport['data']>): SyncSnapshot => ({
  app: 'dotlearn',
  kind: 'progress-export',
  version: 5,
  exportedAt: '2026-07-11T00:00:00.000Z',
  data: { ...EMPTY_DATA, ...data },
});

const progressRow = (id: string, attempts: number): ProgressRecord => ({
  id,
  topicSlug: id.split(':')[0] ?? id,
  exerciseId: id.split(':')[1] ?? id,
  status: 'pass',
  attempts,
  lastAttemptAt: '2026-07-01T00:00:00.000Z',
});

const attempt = (at: string, id?: number): AttemptEventRecord => ({
  ...(id !== undefined ? { id } : {}),
  topicSlug: 'python',
  exerciseId: `ex-${at}`,
  concept: 'c',
  difficulty: '1',
  status: 'pass',
  at,
});

const checkpoint = (at: string, id?: number): CheckpointResultRecord => ({
  ...(id !== undefined ? { id } : {}),
  topicSlug: 'python',
  conceptId: `concept-${at}`,
  status: 'pass',
  at,
});

beforeEach(async () => {
  __test.attachDirtyDetection();
  await Promise.all([
    db.progress.clear(),
    db.attemptEvents.clear(),
    db.checkpointResults.clear(),
    db.bookmarks.clear(),
    db.interviewStudied.clear(),
    db.syncTombstones.clear(),
  ]);
  __test.reset();
  __test.setRunning(false);
});

const bookmarkRow = (id: string, createdAt = '2026-07-01T00:00:00.000Z') => ({
  id,
  topicSlug: id.split(':')[0] ?? id,
  conceptId: id.split(':')[1] ?? id,
  createdAt,
});

describe('applyMerged', () => {
  it('bulkPuts stable-key tables by primary key', async () => {
    await db.progress.put(progressRow('python:ex1', 1));
    await __test.applyMerged(
      snapshot({ progress: [progressRow('python:ex1', 5), progressRow('js:ex2', 2)] }),
    );

    const rows = await db.progress.orderBy('id').toArray();
    expect(rows.map((r) => r.id)).toEqual(['js:ex2', 'python:ex1']);
    expect((await db.progress.get('python:ex1'))?.attempts).toBe(5);
  });

  it('clears and re-adds ++id tables without id, in ascending `at` order', async () => {
    // Pre-seed with a stale row so we can prove clear() ran.
    await db.attemptEvents.add(attempt('2020-01-01T00:00:00.000Z'));

    // Provide rows out of order and carrying foreign ids that must be dropped.
    await __test.applyMerged(
      snapshot({
        attemptEvents: [
          attempt('2026-07-03T00:00:00.000Z', 900),
          attempt('2026-07-01T00:00:00.000Z', 901),
          attempt('2026-07-02T00:00:00.000Z', 902),
        ],
      }),
    );

    const rows = await db.attemptEvents.orderBy('id').toArray();
    expect(rows).toHaveLength(3);
    // Fresh auto-increment ids follow chronological order.
    expect(rows.map((r) => r.at)).toEqual([
      '2026-07-01T00:00:00.000Z',
      '2026-07-02T00:00:00.000Z',
      '2026-07-03T00:00:00.000Z',
    ]);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i]!.id!).toBeGreaterThan(rows[i - 1]!.id!);
    }
    // The stale 2020 row is gone (table was cleared).
    expect(rows.some((r) => r.at.startsWith('2020'))).toBe(false);
  });

  it('re-keys checkpointResults the same way', async () => {
    await __test.applyMerged(
      snapshot({
        checkpointResults: [
          checkpoint('2026-07-05T00:00:00.000Z', 5),
          checkpoint('2026-07-04T00:00:00.000Z', 4),
        ],
      }),
    );
    const rows = await db.checkpointResults.orderBy('id').toArray();
    expect(rows.map((r) => r.at)).toEqual(['2026-07-04T00:00:00.000Z', '2026-07-05T00:00:00.000Z']);
  });

  it('suppresses dirty detection while applying (no hook-triggered loop)', async () => {
    // A normal write fires the hooks.
    await db.progress.put(progressRow('python:ex1', 1));
    expect(__test.getMutationSeq()).toBeGreaterThan(0);

    __test.reset();
    // Applying a merged snapshot must not re-trigger dirty detection.
    await __test.applyMerged(snapshot({ progress: [progressRow('js:ex2', 3)] }));
    expect(__test.getMutationSeq()).toBe(0);
  });
});

describe('dataFingerprint', () => {
  it('ignores volatile exportedAt and syncDeviceId', () => {
    const a = snapshot({ progress: [progressRow('python:ex1', 1)] });
    const b: SyncSnapshot = {
      ...a,
      exportedAt: '2030-01-01T00:00:00.000Z',
      syncDeviceId: 'device-xyz',
    };
    expect(__test.dataFingerprint(a)).toBe(__test.dataFingerprint(b));
  });

  it('changes when data changes', () => {
    const a = snapshot({ progress: [progressRow('python:ex1', 1)] });
    const b = snapshot({ progress: [progressRow('python:ex1', 2)] });
    expect(__test.dataFingerprint(a)).not.toBe(__test.dataFingerprint(b));
  });
});

describe('applyMerged tombstones', () => {
  it('deletes tombstoned local records in a tracked table and keeps the survivors', async () => {
    await db.bookmarks.bulkPut([bookmarkRow('t:c1'), bookmarkRow('t:c2')]);
    // merged keeps c2, drops c1 (killed by a tombstone).
    const merged: SyncSnapshot = {
      ...snapshot({ bookmarks: [bookmarkRow('t:c2')] }),
      tombstones: [
        {
          id: 'bookmarks:t:c1',
          table: 'bookmarks',
          recordKey: 't:c1',
          deletedAt: '2026-07-05T00:00:00.000Z',
        },
      ],
    };
    await __test.applyMerged(merged);
    expect((await db.bookmarks.orderBy('id').toArray()).map((b) => b.id)).toEqual(['t:c2']);
    // the tombstone is persisted locally so this device keeps propagating the deletion.
    expect((await db.syncTombstones.toArray()).map((t) => t.id)).toContain('bookmarks:t:c1');
  });

  it('does NOT delete untracked-table rows that the merge omits (stays additive)', async () => {
    await db.progress.put(progressRow('python:ex1', 1));
    await __test.applyMerged(snapshot({ progress: [progressRow('js:ex2', 2)] }));
    // ex1 is absent from the merged snapshot yet must remain — progress is additive, not tracked.
    expect((await db.progress.orderBy('id').toArray()).map((r) => r.id)).toEqual([
      'js:ex2',
      'python:ex1',
    ]);
  });

  it('applying a tombstone-driven delete does not itself queue a new tombstone', async () => {
    await db.bookmarks.put(bookmarkRow('t:c1'));
    const merged: SyncSnapshot = {
      ...snapshot({ bookmarks: [] }),
      tombstones: [
        {
          id: 'bookmarks:t:c1',
          table: 'bookmarks',
          recordKey: 't:c1',
          deletedAt: '2026-07-05T00:00:00.000Z',
        },
      ],
    };
    await __test.applyMerged(merged);
    await __test.flushTombstones();
    // exactly the propagated tombstone, no self-generated duplicate from the suppressed delete.
    expect((await db.syncTombstones.toArray()).map((t) => t.id)).toEqual(['bookmarks:t:c1']);
  });
});

describe('tombstone recording hook', () => {
  it('records a tombstone when a tracked record is genuinely deleted', async () => {
    __test.setRunning(true);
    try {
      await db.bookmarks.put(bookmarkRow('t:c9'));
      await db.bookmarks.delete('t:c9');
      await __test.flushTombstones();
      expect((await db.syncTombstones.toArray()).map((t) => t.id)).toContain('bookmarks:t:c9');
    } finally {
      __test.setRunning(false);
    }
  });

  it('records no tombstone while a local-only reset is suppressed', async () => {
    __test.setRunning(true);
    __test.setResetSuppressed(true);
    try {
      await db.bookmarks.put(bookmarkRow('t:c8'));
      await db.bookmarks.delete('t:c8');
      await __test.flushTombstones();
      expect((await db.syncTombstones.toArray()).map((t) => t.id)).not.toContain('bookmarks:t:c8');
    } finally {
      __test.setResetSuppressed(false);
      __test.setRunning(false);
    }
  });
});

describe('sync cycle early-exit', () => {
  it('skips encode and push on a rev-unchanged cycle with no local mutation', async () => {
    // jsdom has no Blob.stream(): force codec's no-compression path so the setup push encodes.
    vi.stubGlobal('CompressionStream', undefined);
    vi.mocked(pushSync).mockResolvedValue({ rev: 1, updatedAt: Date.now() });
    __test.setRunning(true);
    try {
      // A local edit makes the first cycle build, encode and push, recording the pushed fingerprint.
      await db.progress.put(progressRow('python:ex1', 1));
      expect(__test.getDirty()).toBe(true);
      await __test.reconcile('ABCDEFGHJKMN', 1, null, 0);
      expect(pushSync).toHaveBeenCalledTimes(1);
      expect(__test.getDirty()).toBe(false);

      // Same state, server rev unchanged: the cycle must early-exit without encoding or pushing.
      vi.mocked(pushSync).mockClear();
      await __test.reconcile('ABCDEFGHJKMN', 1, null, 0);
      expect(pushSync).not.toHaveBeenCalled();
    } finally {
      __test.setRunning(false);
      vi.unstubAllGlobals();
    }
  });
});
