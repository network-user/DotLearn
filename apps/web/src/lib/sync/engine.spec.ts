import { beforeEach, describe, expect, it } from 'vitest';

import {
  db,
  type AttemptEventRecord,
  type CheckpointResultRecord,
  type ProgressRecord,
} from '../progress-db';
import type { ProgressExport } from '../progress-io';

import { __test } from './engine';
import type { SyncSnapshot } from './merge';

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
  await Promise.all([db.progress.clear(), db.attemptEvents.clear(), db.checkpointResults.clear()]);
  __test.reset();
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
