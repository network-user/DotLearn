/**
 * @vitest-environment node
 *
 * merge.ts is a pure module (no Dexie/DOM), so its suite runs under the plain node environment
 * even though the rest of apps/web's tests default to jsdom. Globals are off - vitest helpers
 * are imported explicitly.
 */
import { describe, expect, it } from 'vitest';

import { canonicalStringify, mergeSnapshots, snapshotHash, type SyncSnapshot } from './merge';
import type { ProgressExport } from '../progress-io';
import type { AppSettingsBackup } from '../settings';

type Row = Record<string, unknown>;
type PartialData = Partial<Record<keyof ProgressExport['data'], unknown[]>>;

interface SnapOpts {
  exportedAt?: string;
  settings?: AppSettingsBackup;
  syncDeviceId?: string;
}

const EMPTY_TABLES: (keyof ProgressExport['data'])[] = [
  'progress',
  'activity',
  'flashcardReviews',
  'interviewStudied',
  'topicPlace',
  'conceptNotes',
  'bookmarks',
  'conceptRead',
  'conceptScroll',
  'highlights',
  'attemptEvents',
  'achievements',
  'checkpointResults',
  'examResults',
  'userCards',
  'reExamSchedule',
];

const snap = (data: PartialData = {}, opts: SnapOpts = {}): SyncSnapshot => {
  const full: Record<string, unknown[]> = {};
  for (const table of EMPTY_TABLES) full[table] = [];
  Object.assign(full, data);
  const base: Record<string, unknown> = {
    app: 'dotlearn',
    kind: 'progress-export',
    version: 5,
    exportedAt: opts.exportedAt ?? '2026-01-01T00:00:00.000Z',
    data: full,
  };
  if (opts.settings !== undefined) base.settings = opts.settings;
  if (opts.syncDeviceId !== undefined) base.syncDeviceId = opts.syncDeviceId;
  return base as unknown as SyncSnapshot;
};

const canon = (s: SyncSnapshot): string => canonicalStringify(s);

const tables = (s: SyncSnapshot): Record<string, Row[]> =>
  s.data as unknown as Record<string, Row[]>;

const table = (s: SyncSnapshot, name: keyof ProgressExport['data']): Row[] => tables(s)[name] ?? [];

const byId = (rows: Row[], id: unknown): Row | undefined => rows.find((r) => r.id === id);

const settingsFixture = (accent: AppSettingsBackup['accent']): AppSettingsBackup => ({
  accent,
  themePreference: 'light',
  contrast: 'system',
  density: 'comfortable',
  motion: 'system',
  contentLanguage: 'follow-ui',
  reading: 'normal',
  readingFont: 'serif',
  readingSpacing: 'normal',
  readingWidth: 'default',
  editor: {
    fontSize: 13,
    tabSize: 'language-default',
    wordWrap: false,
    autocomplete: true,
    lineNumbers: true,
  },
});

// A dense fixture that exercises every table with a mix of overlapping and disjoint records,
// LWW conflicts, unions, tag arrays and content-keyed event logs.
const richA = (): SyncSnapshot =>
  snap(
    {
      progress: [
        {
          id: 't:e1',
          topicSlug: 't',
          exerciseId: 'e1',
          status: 'fail',
          attempts: 2,
          lastAttemptAt: '2026-02-01T00:00:00.000Z',
        },
        {
          id: 't:e2',
          topicSlug: 't',
          exerciseId: 'e2',
          status: 'pass',
          attempts: 1,
          lastAttemptAt: '2026-02-01T00:00:00.000Z',
        },
      ],
      activity: [
        { day: '2026-02-01', exercisesAttempted: 3, exercisesPassed: 1, conceptsRead: 2 },
        { day: '2026-02-02', exercisesAttempted: 1, exercisesPassed: 0 },
      ],
      flashcardReviews: [
        {
          id: 'c1',
          topicSlug: 't',
          cardId: 'c1',
          due: '2026-03-01T00:00:00.000Z',
          stability: 1,
          difficulty: 5,
          elapsedDays: 0,
          scheduledDays: 1,
          reps: 2,
          lapses: 0,
          state: 2,
          lastReviewAt: '2026-02-01T00:00:00.000Z',
        },
      ],
      interviewStudied: [{ id: 5, studiedAt: '2026-02-01T00:00:00.000Z' }],
      topicPlace: [{ topicSlug: 't', conceptId: 'c1', updatedAt: '2026-02-01T00:00:00.000Z' }],
      conceptNotes: [
        {
          id: 't:c1',
          topicSlug: 't',
          conceptId: 'c1',
          text: 'a',
          updatedAt: '2026-02-01T00:00:00.000Z',
          tags: ['x'],
        },
      ],
      bookmarks: [
        {
          id: 't:c1',
          topicSlug: 't',
          conceptId: 'c1',
          createdAt: '2026-02-02T00:00:00.000Z',
          tags: ['red', 'blue'],
        },
      ],
      conceptRead: [
        { id: 't:c1', topicSlug: 't', conceptId: 'c1', readAt: '2026-02-02T00:00:00.000Z' },
      ],
      conceptScroll: [
        {
          id: 't:c1',
          topicSlug: 't',
          conceptId: 'c1',
          anchorOffset: 10,
          ratio: 0.5,
          updatedAt: '2026-02-01T00:00:00.000Z',
        },
      ],
      highlights: [
        {
          id: 'h1',
          topicSlug: 't',
          conceptId: 'c1',
          text: 'hi',
          color: 'yellow',
          createdAt: '2026-02-01T00:00:00.000Z',
        },
      ],
      attemptEvents: [
        {
          id: 1,
          topicSlug: 't',
          exerciseId: 'e1',
          concept: 'c',
          difficulty: '1',
          status: 'fail',
          at: '2026-02-01T00:00:00.000Z',
        },
        {
          id: 2,
          topicSlug: 't',
          exerciseId: 'e1',
          concept: 'c',
          difficulty: '1',
          status: 'pass',
          at: '2026-02-01T00:01:00.000Z',
        },
      ],
      achievements: [{ id: 'ach1', unlockedAt: '2026-02-02T00:00:00.000Z' }],
      checkpointResults: [
        {
          id: 1,
          topicSlug: 't',
          conceptId: 'c1',
          status: 'pass',
          at: '2026-02-01T00:00:00.000Z',
          source: 'checkpoint',
        },
      ],
      examResults: [
        {
          id: 'ex1',
          scope: 's',
          filters: {},
          total: 10,
          correct: 8,
          byType: {},
          byDifficulty: {},
          durationMs: 1000,
          startedAt: '2026-02-01T00:00:00.000Z',
          finishedAt: '2026-02-01T00:10:00.000Z',
        },
      ],
      userCards: [
        { id: 'u1', front: 'f', back: 'b', topicSlug: 't', createdAt: '2026-02-01T00:00:00.000Z' },
      ],
      reExamSchedule: [
        {
          id: 't:c1',
          topicSlug: 't',
          conceptId: 'c1',
          due: '2026-03-01T00:00:00.000Z',
          stepIndex: 1,
          streak: 1,
          lastStatus: 'pass',
          graduated: false,
          updatedAt: '2026-02-01T00:00:00.000Z',
        },
      ],
    },
    {
      exportedAt: '2026-02-02T00:00:00.000Z',
      settings: settingsFixture('blue'),
      syncDeviceId: 'devA',
    },
  );

const richB = (): SyncSnapshot =>
  snap(
    {
      progress: [
        {
          id: 't:e1',
          topicSlug: 't',
          exerciseId: 'e1',
          status: 'pass',
          attempts: 5,
          lastAttemptAt: '2026-02-05T00:00:00.000Z',
        },
        {
          id: 't:e3',
          topicSlug: 't',
          exerciseId: 'e3',
          status: 'fail',
          attempts: 1,
          lastAttemptAt: '2026-02-03T00:00:00.000Z',
        },
      ],
      activity: [
        { day: '2026-02-01', exercisesAttempted: 1, exercisesPassed: 1, cardsReviewed: 4 },
        { day: '2026-02-03', exercisesAttempted: 2, exercisesPassed: 2 },
      ],
      flashcardReviews: [
        {
          id: 'c1',
          topicSlug: 't',
          cardId: 'c1',
          due: '2026-03-10T00:00:00.000Z',
          stability: 3,
          difficulty: 4,
          elapsedDays: 1,
          scheduledDays: 9,
          reps: 3,
          lapses: 0,
          state: 2,
          lastReviewAt: '2026-02-06T00:00:00.000Z',
        },
      ],
      interviewStudied: [
        { id: 5, studiedAt: '2026-01-15T00:00:00.000Z' },
        { id: 7, studiedAt: '2026-02-04T00:00:00.000Z' },
      ],
      topicPlace: [{ topicSlug: 't', conceptId: 'c2', updatedAt: '2026-02-05T00:00:00.000Z' }],
      conceptNotes: [
        {
          id: 't:c1',
          topicSlug: 't',
          conceptId: 'c1',
          text: 'edited',
          updatedAt: '2026-02-05T00:00:00.000Z',
        },
      ],
      bookmarks: [
        {
          id: 't:c1',
          topicSlug: 't',
          conceptId: 'c1',
          createdAt: '2026-01-20T00:00:00.000Z',
          tags: ['green', 'blue'],
        },
      ],
      conceptRead: [
        { id: 't:c1', topicSlug: 't', conceptId: 'c1', readAt: '2026-01-20T00:00:00.000Z' },
      ],
      conceptScroll: [
        {
          id: 't:c1',
          topicSlug: 't',
          conceptId: 'c1',
          anchorOffset: 99,
          ratio: 0.9,
          updatedAt: '2026-02-06T00:00:00.000Z',
        },
      ],
      highlights: [
        {
          id: 'h1',
          topicSlug: 't',
          conceptId: 'c1',
          text: 'hi',
          color: 'yellow',
          note: 'important',
          createdAt: '2026-02-01T00:00:00.000Z',
        },
      ],
      attemptEvents: [
        {
          id: 8,
          topicSlug: 't',
          exerciseId: 'e1',
          concept: 'c',
          difficulty: '1',
          status: 'pass',
          at: '2026-02-01T00:01:00.000Z',
        },
        {
          id: 9,
          topicSlug: 't',
          exerciseId: 'e3',
          concept: 'c',
          difficulty: '2',
          status: 'fail',
          at: '2026-02-03T00:00:00.000Z',
        },
      ],
      achievements: [{ id: 'ach1', unlockedAt: '2026-01-10T00:00:00.000Z' }],
      checkpointResults: [
        {
          id: 4,
          topicSlug: 't',
          conceptId: 'c1',
          status: 'pass',
          at: '2026-02-01T00:00:00.000Z',
          source: 'checkpoint',
        },
        { id: 5, topicSlug: 't', conceptId: 'c2', status: 'fail', at: '2026-02-05T00:00:00.000Z' },
      ],
      examResults: [
        {
          id: 'ex2',
          scope: 's',
          filters: {},
          total: 5,
          correct: 5,
          byType: {},
          byDifficulty: {},
          durationMs: 500,
          startedAt: '2026-02-05T00:00:00.000Z',
          finishedAt: '2026-02-05T00:05:00.000Z',
        },
      ],
      userCards: [
        {
          id: 'u2',
          front: 'f2',
          back: 'b2',
          topicSlug: 't',
          createdAt: '2026-02-05T00:00:00.000Z',
        },
      ],
      reExamSchedule: [
        {
          id: 't:c1',
          topicSlug: 't',
          conceptId: 'c1',
          due: '2026-03-20T00:00:00.000Z',
          stepIndex: 2,
          streak: 2,
          lastStatus: 'pass',
          graduated: false,
          updatedAt: '2026-02-06T00:00:00.000Z',
        },
      ],
    },
    {
      exportedAt: '2026-02-06T00:00:00.000Z',
      settings: settingsFixture('violet'),
      syncDeviceId: 'devB',
    },
  );

describe('mergeSnapshots invariants', () => {
  it('is symmetric across a rich fixture', () => {
    expect(canon(mergeSnapshots(richA(), richB()))).toBe(canon(mergeSnapshots(richB(), richA())));
  });

  it('is idempotent when re-merging with either input', () => {
    const merged = mergeSnapshots(richA(), richB());
    expect(canon(mergeSnapshots(merged, richB()))).toBe(canon(merged));
    expect(canon(mergeSnapshots(merged, richA()))).toBe(canon(merged));
    expect(canon(mergeSnapshots(merged, merged))).toBe(canon(merged));
  });

  it('merging a snapshot with an empty one normalizes it stably', () => {
    const normalized = mergeSnapshots(richA(), snap());
    expect(canon(mergeSnapshots(normalized, snap()))).toBe(canon(normalized));
    expect(canon(mergeSnapshots(snap(), richA()))).toBe(canon(normalized));
  });

  it('always carries version 5 and the later exportedAt', () => {
    const merged = mergeSnapshots(richA(), richB());
    expect(merged.version).toBe(5);
    expect(merged.exportedAt).toBe('2026-02-06T00:00:00.000Z');
    expect(merged.app).toBe('dotlearn');
    expect(merged.kind).toBe('progress-export');
  });
});

describe('progress', () => {
  it('pass wins over fail; attempts and lastAttemptAt take the max', () => {
    const merged = mergeSnapshots(richA(), richB());
    const row = byId(table(merged, 'progress'), 't:e1');
    expect(row?.status).toBe('pass');
    expect(row?.attempts).toBe(5);
    expect(row?.lastAttemptAt).toBe('2026-02-05T00:00:00.000Z');
  });

  it('keeps disjoint rows from both sides', () => {
    const rows = table(mergeSnapshots(richA(), richB()), 'progress');
    expect(rows.map((r) => r.id).sort()).toEqual(['t:e1', 't:e2', 't:e3']);
  });
});

describe('activity', () => {
  it('takes the per-counter max, not the sum', () => {
    const merged = mergeSnapshots(richA(), richB());
    const day = table(merged, 'activity').find((r) => r.day === '2026-02-01');
    expect(day?.exercisesAttempted).toBe(3); // max(3, 1), not 4
    expect(day?.exercisesPassed).toBe(1); // max(1, 1)
    expect(day?.conceptsRead).toBe(2); // present only on A
    expect(day?.cardsReviewed).toBe(4); // present only on B
  });

  it('keeps a counter absent when absent on both sides', () => {
    const merged = mergeSnapshots(
      snap({ activity: [{ day: 'd', exercisesAttempted: 1, exercisesPassed: 0 }] }),
      snap({ activity: [{ day: 'd', exercisesAttempted: 2, exercisesPassed: 0 }] }),
    );
    const row = table(merged, 'activity')[0];
    expect(row).toBeDefined();
    expect('focusBlocks' in (row as Row)).toBe(false);
    expect('cardsReviewed' in (row as Row)).toBe(false);
  });
});

describe('flashcardReviews (LWW by lastReviewAt)', () => {
  it('later lastReviewAt wins', () => {
    const merged = mergeSnapshots(richA(), richB());
    const row = byId(table(merged, 'flashcardReviews'), 'c1');
    expect(row?.reps).toBe(3);
    expect(row?.lastReviewAt).toBe('2026-02-06T00:00:00.000Z');
  });

  it('breaks a lastReviewAt tie by higher reps, then later due', () => {
    const base = {
      id: 'c',
      topicSlug: 't',
      cardId: 'c',
      stability: 1,
      difficulty: 1,
      elapsedDays: 0,
      scheduledDays: 1,
      lapses: 0,
      state: 1,
      lastReviewAt: '2026-02-01T00:00:00.000Z',
    };
    const lowReps = snap({
      flashcardReviews: [{ ...base, reps: 1, due: '2026-03-01T00:00:00.000Z' }],
    });
    const highReps = snap({
      flashcardReviews: [{ ...base, reps: 9, due: '2026-03-01T00:00:00.000Z' }],
    });
    expect(byId(table(mergeSnapshots(lowReps, highReps), 'flashcardReviews'), 'c')?.reps).toBe(9);

    const earlyDue = snap({
      flashcardReviews: [{ ...base, reps: 3, due: '2026-03-01T00:00:00.000Z' }],
    });
    const lateDue = snap({
      flashcardReviews: [{ ...base, reps: 3, due: '2026-09-09T00:00:00.000Z' }],
    });
    expect(byId(table(mergeSnapshots(earlyDue, lateDue), 'flashcardReviews'), 'c')?.due).toBe(
      '2026-09-09T00:00:00.000Z',
    );
  });

  it('treats a missing lastReviewAt as epoch 0', () => {
    const withReview = snap({
      flashcardReviews: [
        {
          id: 'c',
          topicSlug: 't',
          cardId: 'c',
          due: 'd',
          stability: 1,
          difficulty: 1,
          elapsedDays: 0,
          scheduledDays: 1,
          reps: 1,
          lapses: 0,
          state: 1,
          lastReviewAt: '2026-02-01T00:00:00.000Z',
        },
      ],
    });
    const noReview = snap({
      flashcardReviews: [
        {
          id: 'c',
          topicSlug: 't',
          cardId: 'c',
          due: 'd',
          stability: 9,
          difficulty: 9,
          elapsedDays: 0,
          scheduledDays: 1,
          reps: 9,
          lapses: 0,
          state: 1,
        },
      ],
    });
    // The dated review beats the undated one despite the latter's higher reps.
    expect(
      byId(table(mergeSnapshots(withReview, noReview), 'flashcardReviews'), 'c')?.stability,
    ).toBe(1);
  });
});

describe('LWW by updatedAt (topicPlace / conceptNotes / conceptScroll / reExamSchedule)', () => {
  it('later updatedAt wins and the record is kept verbatim', () => {
    const merged = mergeSnapshots(richA(), richB());
    expect(byId(table(merged, 'conceptNotes'), 't:c1')?.text).toBe('edited');
    expect(byId(table(merged, 'conceptScroll'), 't:c1')?.anchorOffset).toBe(99);
    expect(byId(table(merged, 'reExamSchedule'), 't:c1')?.stepIndex).toBe(2);
    // topicPlace keys by topicSlug and both rows share slug 't' -> later one wins.
    const places = table(merged, 'topicPlace');
    expect(places).toHaveLength(1);
    expect(places[0]?.conceptId).toBe('c2');
  });

  it('conceptNotes LWW keeps the whole winning record including its tags', () => {
    const older = snap({
      conceptNotes: [
        {
          id: 'n',
          topicSlug: 't',
          conceptId: 'c',
          text: 'old',
          updatedAt: '2026-01-01T00:00:00.000Z',
          tags: ['keep'],
        },
      ],
    });
    const newer = snap({
      conceptNotes: [
        {
          id: 'n',
          topicSlug: 't',
          conceptId: 'c',
          text: 'new',
          updatedAt: '2026-05-01T00:00:00.000Z',
        },
      ],
    });
    const row = byId(table(mergeSnapshots(older, newer), 'conceptNotes'), 'n');
    expect(row?.text).toBe('new');
    expect('tags' in (row as Row)).toBe(false); // winner had no tags; no field mixing
  });

  it('breaks an equal-timestamp tie deterministically and symmetrically', () => {
    const x = snap({
      topicPlace: [{ topicSlug: 't', conceptId: 'aaa', updatedAt: '2026-02-01T00:00:00.000Z' }],
    });
    const y = snap({
      topicPlace: [{ topicSlug: 't', conceptId: 'zzz', updatedAt: '2026-02-01T00:00:00.000Z' }],
    });
    const forward = table(mergeSnapshots(x, y), 'topicPlace')[0];
    const backward = table(mergeSnapshots(y, x), 'topicPlace')[0];
    expect(forward?.conceptId).toBe('aaa'); // canonically-smaller record wins
    expect(forward?.conceptId).toBe(backward?.conceptId); // order-independent winner
  });
});

describe('unions with min timestamp', () => {
  it('interviewStudied unions by id and keeps the earliest studiedAt', () => {
    const merged = mergeSnapshots(richA(), richB());
    const rows = table(merged, 'interviewStudied');
    expect(rows.map((r) => r.id).sort()).toEqual([5, 7]);
    expect(byId(rows, 5)?.studiedAt).toBe('2026-01-15T00:00:00.000Z'); // min of the two
  });

  it('achievements union keeps the earliest unlockedAt', () => {
    expect(byId(table(mergeSnapshots(richA(), richB()), 'achievements'), 'ach1')?.unlockedAt).toBe(
      '2026-01-10T00:00:00.000Z',
    );
  });

  it('conceptRead union keeps the earliest readAt', () => {
    expect(byId(table(mergeSnapshots(richA(), richB()), 'conceptRead'), 't:c1')?.readAt).toBe(
      '2026-01-20T00:00:00.000Z',
    );
  });

  it('bookmarks union keeps min createdAt and the union of tag arrays', () => {
    const row = byId(table(mergeSnapshots(richA(), richB()), 'bookmarks'), 't:c1');
    expect(row?.createdAt).toBe('2026-01-20T00:00:00.000Z'); // min
    expect(row?.tags).toEqual(['blue', 'green', 'red']); // dedup + sorted union of ['red','blue'] & ['green','blue']
  });
});

describe('highlights (union, note preference)', () => {
  it('prefers the record that has a non-empty note on an id collision', () => {
    const row = byId(table(mergeSnapshots(richA(), richB()), 'highlights'), 'h1');
    expect(row?.note).toBe('important');
  });

  it('falls back to a deterministic winner when neither has a note', () => {
    const x = snap({
      highlights: [
        {
          id: 'h',
          topicSlug: 't',
          conceptId: 'c',
          text: 'aaa',
          color: 'blue',
          createdAt: '2026-02-01T00:00:00.000Z',
        },
      ],
    });
    const y = snap({
      highlights: [
        {
          id: 'h',
          topicSlug: 't',
          conceptId: 'c',
          text: 'zzz',
          color: 'pink',
          createdAt: '2026-02-01T00:00:00.000Z',
        },
      ],
    });
    expect(byId(table(mergeSnapshots(x, y), 'highlights'), 'h')).toEqual(
      byId(table(mergeSnapshots(y, x), 'highlights'), 'h'),
    );
  });
});

describe('immutable unions (examResults / userCards)', () => {
  it('unions rows from both sides by id', () => {
    const merged = mergeSnapshots(richA(), richB());
    expect(
      table(merged, 'examResults')
        .map((r) => r.id)
        .sort(),
    ).toEqual(['ex1', 'ex2']);
    expect(
      table(merged, 'userCards')
        .map((r) => r.id)
        .sort(),
    ).toEqual(['u1', 'u2']);
  });
});

describe('attemptEvents (content-keyed ++id)', () => {
  it('drops ids, dedups by content key, sorts ascending by at', () => {
    const merged = mergeSnapshots(richA(), richB());
    const rows = table(merged, 'attemptEvents');
    // A's event #2 and B's event #8 share every content field -> one row.
    expect(rows).toHaveLength(3);
    for (const r of rows) expect('id' in r).toBe(false);
    const ats = rows.map((r) => r.at);
    expect(ats).toEqual([...ats].sort());
  });

  it('caps at 4000 keeping the newest by at', () => {
    const many = Array.from({ length: 4200 }, (_, i) => ({
      id: i,
      topicSlug: 't',
      exerciseId: 'e',
      concept: 'c',
      difficulty: '1',
      status: 'pass' as const,
      at: new Date(Date.UTC(2026, 0, 1) + i * 60_000).toISOString(),
    }));
    const rows = table(mergeSnapshots(snap({ attemptEvents: many }), snap()), 'attemptEvents');
    expect(rows).toHaveLength(4000);
    // Newest kept, oldest dropped.
    expect(rows[rows.length - 1]?.at).toBe(many[many.length - 1]?.at);
    expect(rows[0]?.at).toBe(many[200]?.at);
  });

  it('the 4000 cap stays idempotent under re-merge', () => {
    const many = Array.from({ length: 4200 }, (_, i) => ({
      id: i,
      topicSlug: 't',
      exerciseId: 'e',
      concept: 'c',
      difficulty: '1',
      status: 'pass' as const,
      at: new Date(Date.UTC(2026, 0, 1) + i * 60_000).toISOString(),
    }));
    const a = snap({ attemptEvents: many });
    const merged = mergeSnapshots(a, snap());
    expect(canon(mergeSnapshots(merged, a))).toBe(canon(merged));
  });
});

describe('checkpointResults (content-keyed ++id)', () => {
  it('drops ids and dedups a row that differs only by id / default source', () => {
    // A tags source explicitly 'checkpoint'; B omits it (defaults to 'checkpoint') -> same key.
    const a = snap({
      checkpointResults: [
        {
          id: 1,
          topicSlug: 't',
          conceptId: 'c',
          status: 'pass',
          at: '2026-02-01T00:00:00.000Z',
          source: 'checkpoint',
        },
      ],
    });
    const b = snap({
      checkpointResults: [
        { id: 99, topicSlug: 't', conceptId: 'c', status: 'pass', at: '2026-02-01T00:00:00.000Z' },
      ],
    });
    const rows = table(mergeSnapshots(a, b), 'checkpointResults');
    expect(rows).toHaveLength(1);
    expect('id' in (rows[0] as Row)).toBe(false);
  });

  it('keeps distinct recall vs checkpoint rows and sorts ascending by at', () => {
    const merged = mergeSnapshots(richA(), richB());
    const rows = table(merged, 'checkpointResults');
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const ats = rows.map((r) => r.at);
    expect(ats).toEqual([...ats].sort());
  });
});

describe('settings (snapshot LWW by exportedAt)', () => {
  it('takes the settings of the later-exported snapshot and its syncDeviceId', () => {
    const merged = mergeSnapshots(richA(), richB()); // B exported later
    expect(merged.settings?.accent).toBe('violet');
    expect(merged.syncDeviceId).toBe('devB');
  });

  it('takes the other side when one snapshot lacks settings, regardless of exportedAt', () => {
    const older = snap(
      {},
      {
        exportedAt: '2026-01-01T00:00:00.000Z',
        settings: settingsFixture('amber'),
        syncDeviceId: 'old',
      },
    );
    const newerNoSettings = snap(
      {},
      { exportedAt: '2026-09-09T00:00:00.000Z', syncDeviceId: 'new' },
    );
    const merged = mergeSnapshots(older, newerNoSettings);
    expect(merged.settings?.accent).toBe('amber');
    expect(merged.syncDeviceId).toBe('old');
  });

  it('omits settings entirely when neither side has them', () => {
    const merged = mergeSnapshots(snap(), snap());
    expect('settings' in merged).toBe(false);
  });

  it('is a no-op on deep-equal settings and stays symmetric for syncDeviceId', () => {
    const a = snap(
      {},
      {
        exportedAt: '2026-02-01T00:00:00.000Z',
        settings: settingsFixture('teal'),
        syncDeviceId: 'A',
      },
    );
    const b = snap(
      {},
      {
        exportedAt: '2026-02-01T00:00:00.000Z',
        settings: settingsFixture('teal'),
        syncDeviceId: 'B',
      },
    );
    expect(mergeSnapshots(a, b).settings).toEqual(settingsFixture('teal'));
    expect(mergeSnapshots(a, b).syncDeviceId).toBe(mergeSnapshots(b, a).syncDeviceId);
  });
});

describe('defensive handling', () => {
  it('treats missing tables as empty arrays', () => {
    const bare = {
      app: 'dotlearn',
      kind: 'progress-export',
      version: 3,
      exportedAt: '2026-01-01T00:00:00.000Z',
      data: {
        progress: [
          {
            id: 'p',
            topicSlug: 't',
            exerciseId: 'e',
            status: 'pass',
            attempts: 1,
            lastAttemptAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    } as unknown as SyncSnapshot;
    const merged = mergeSnapshots(bare, snap());
    expect(table(merged, 'progress')).toHaveLength(1);
    expect(table(merged, 'userCards')).toEqual([]);
    expect(table(merged, 'checkpointResults')).toEqual([]);
  });

  it('drops malformed records missing key/comparison fields', () => {
    const junk = snap({
      progress: [
        {
          id: 'ok',
          topicSlug: 't',
          exerciseId: 'e',
          status: 'pass',
          attempts: 1,
          lastAttemptAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'no-status',
          topicSlug: 't',
          exerciseId: 'e',
          attempts: 1,
          lastAttemptAt: '2026-01-01T00:00:00.000Z',
        },
        {
          topicSlug: 't',
          exerciseId: 'e',
          status: 'pass',
          attempts: 1,
          lastAttemptAt: '2026-01-01T00:00:00.000Z',
        }, // no id
        'not-an-object',
        null,
      ],
      attemptEvents: [
        {
          topicSlug: 't',
          exerciseId: 'e',
          concept: 'c',
          difficulty: '1',
          status: 'pass',
          at: '2026-01-01T00:00:00.000Z',
        },
        { topicSlug: 't', exerciseId: 'e', concept: 'c', difficulty: '1', status: 'pass' }, // no at
      ],
    });
    const merged = mergeSnapshots(junk, snap());
    expect(table(merged, 'progress').map((r) => r.id)).toEqual(['ok']);
    expect(table(merged, 'attemptEvents')).toHaveLength(1);
  });
});

describe('canonicalStringify', () => {
  it('is independent of object key order', () => {
    const a = { b: 1, a: { d: 4, c: 3 } } as unknown as SyncSnapshot;
    const b = { a: { c: 3, d: 4 }, b: 1 } as unknown as SyncSnapshot;
    expect(canonicalStringify(a)).toBe(canonicalStringify(b));
  });

  it('preserves array order', () => {
    const a = { xs: [1, 2, 3] } as unknown as SyncSnapshot;
    const b = { xs: [3, 2, 1] } as unknown as SyncSnapshot;
    expect(canonicalStringify(a)).not.toBe(canonicalStringify(b));
  });
});

describe('snapshotHash', () => {
  it('is equal for equal states and independent of key order', () => {
    expect(snapshotHash(mergeSnapshots(richA(), richB()))).toBe(
      snapshotHash(mergeSnapshots(richB(), richA())),
    );
    const a = { b: 1, a: 2 } as unknown as SyncSnapshot;
    const b = { a: 2, b: 1 } as unknown as SyncSnapshot;
    expect(snapshotHash(a)).toBe(snapshotHash(b));
  });

  it('differs when content differs', () => {
    const a = mergeSnapshots(richA(), snap());
    const b = mergeSnapshots(richB(), snap());
    expect(snapshotHash(a)).not.toBe(snapshotHash(b));
  });

  it('returns 16 hex chars', () => {
    expect(snapshotHash(snap())).toMatch(/^[0-9a-f]{16}$/);
  });
});
