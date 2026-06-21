import { beforeEach, describe, expect, it } from 'vitest';

import {
  db,
  type AchievementRecord,
  type ActivityRecord,
  type BookmarkRecord,
  type CheckpointResultRecord,
  type ConceptNoteRecord,
  type ExamResultRecord,
  type FlashcardReviewRecord,
  type HighlightRecord,
  type ProgressRecord,
  type UserCardRecord,
} from './progress-db';
import {
  exportProgress,
  importProgress,
  ProgressImportError,
  type ProgressExport,
} from './progress-io';

const seedProgress: ProgressRecord[] = [
  {
    id: 'fastapi:ex1',
    topicSlug: 'fastapi',
    exerciseId: 'ex1',
    status: 'pass',
    attempts: 3,
    lastAttemptAt: '2026-06-19T10:00:00.000Z',
  },
  {
    id: 'django:ex2',
    topicSlug: 'django',
    exerciseId: 'ex2',
    status: 'fail',
    attempts: 1,
    lastAttemptAt: '2026-06-19T11:00:00.000Z',
  },
];

const seedActivity: ActivityRecord[] = [
  { day: '2026-06-18', exercisesAttempted: 4, exercisesPassed: 2 },
  { day: '2026-06-19', exercisesAttempted: 6, exercisesPassed: 5, cardsReviewed: 10 },
];

const seedFlashcardReviews: FlashcardReviewRecord[] = [
  {
    id: 'fastapi:card-1',
    topicSlug: 'fastapi',
    cardId: 'card-1',
    due: '2026-06-25T00:00:00.000Z',
    stability: 12.5,
    difficulty: 5.2,
    elapsedDays: 3,
    scheduledDays: 6,
    reps: 4,
    lapses: 1,
    state: 2,
  },
];

const seedConceptNotes: ConceptNoteRecord[] = [
  {
    id: 'fastapi:routing',
    topicSlug: 'fastapi',
    conceptId: 'routing',
    text: 'path params are typed',
    updatedAt: '2026-06-19T09:00:00.000Z',
  },
];

const seedBookmarks: BookmarkRecord[] = [
  {
    id: 'django:orm',
    topicSlug: 'django',
    conceptId: 'orm',
    createdAt: '2026-06-19T08:00:00.000Z',
  },
];

const seedHighlights: HighlightRecord[] = [
  {
    id: 'hl-1',
    topicSlug: 'django',
    conceptId: 'orm',
    text: 'querysets are lazy',
    color: 'yellow',
    createdAt: '2026-06-19T08:30:00.000Z',
  },
];

const seedExamResults: ExamResultRecord[] = [
  {
    id: 'exam-1',
    scope: 'fastapi',
    filters: { difficulty: 'easy' },
    total: 10,
    correct: 8,
    byType: { 'theory-quiz': { total: 10, correct: 8 } },
    byDifficulty: { '1': { total: 10, correct: 8 } },
    durationMs: 120000,
    startedAt: '2026-06-19T07:00:00.000Z',
    finishedAt: '2026-06-19T07:02:00.000Z',
  },
];

const seedUserCards: UserCardRecord[] = [
  {
    id: 'uc-1',
    front: 'What is a dependency?',
    back: 'A callable injected by FastAPI.',
    topicSlug: 'fastapi',
    createdAt: '2026-06-19T06:00:00.000Z',
  },
];

const seedDb = async (): Promise<void> => {
  await db.progress.bulkPut(seedProgress);
  await db.activity.bulkPut(seedActivity);
  await db.flashcardReviews.bulkPut(seedFlashcardReviews);
  await db.conceptNotes.bulkPut(seedConceptNotes);
  await db.bookmarks.bulkPut(seedBookmarks);
  await db.highlights.bulkPut(seedHighlights);
  await db.examResults.bulkPut(seedExamResults);
  await db.userCards.bulkPut(seedUserCards);
};

const emptyData = (): ProgressExport['data'] => ({
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
});

const wrap = (version: number, data: Partial<ProgressExport['data']>): ProgressExport => ({
  app: 'dotlearn',
  kind: 'progress-export',
  version,
  exportedAt: '2026-06-19T12:00:00.000Z',
  data: { ...emptyData(), ...data },
});

const sortById = <T extends { id: string }>(records: T[]): T[] =>
  [...records].sort((a, b) => a.id.localeCompare(b.id));

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('exportProgress / importProgress round-trip', () => {
  it('restores every seeded table after clear and re-import', async () => {
    await seedDb();

    const exported = await exportProgress();

    await db.delete();
    await db.open();

    const summary = await importProgress(exported);

    expect(summary.skipped).toBe(0);
    expect(summary.imported).toBe(
      seedProgress.length +
        seedActivity.length +
        seedFlashcardReviews.length +
        seedConceptNotes.length +
        seedBookmarks.length +
        seedHighlights.length +
        seedExamResults.length +
        seedUserCards.length,
    );

    const reExported = await exportProgress();

    expect(sortById(reExported.data.progress)).toEqual(sortById(seedProgress));
    expect([...reExported.data.activity].sort((a, b) => a.day.localeCompare(b.day))).toEqual(
      [...seedActivity].sort((a, b) => a.day.localeCompare(b.day)),
    );
    expect(sortById(reExported.data.flashcardReviews)).toEqual(sortById(seedFlashcardReviews));
    expect(sortById(reExported.data.conceptNotes)).toEqual(sortById(seedConceptNotes));
    expect(sortById(reExported.data.bookmarks)).toEqual(sortById(seedBookmarks));
    expect(sortById(reExported.data.highlights)).toEqual(sortById(seedHighlights));
    expect(sortById(reExported.data.examResults)).toEqual(sortById(seedExamResults));
    expect(sortById(reExported.data.userCards)).toEqual(sortById(seedUserCards));
  });
});

describe('importProgress validation', () => {
  it('rejects non-object input', async () => {
    await expect(importProgress('not-an-object')).rejects.toBeInstanceOf(ProgressImportError);
  });

  it('rejects null input', async () => {
    await expect(importProgress(null)).rejects.toBeInstanceOf(ProgressImportError);
  });

  it('rejects a payload with the wrong kind', async () => {
    await expect(
      importProgress({ kind: 'something-else', data: emptyData() }),
    ).rejects.toBeInstanceOf(ProgressImportError);
  });

  it('rejects a payload missing data', async () => {
    await expect(importProgress({ kind: 'progress-export' })).rejects.toBeInstanceOf(
      ProgressImportError,
    );
  });

  it('rejects a payload whose data is not an object', async () => {
    await expect(importProgress({ kind: 'progress-export', data: 'nope' })).rejects.toBeInstanceOf(
      ProgressImportError,
    );
  });
});

describe('importProgress skips malformed records', () => {
  it('imports valid records and counts the dropped ones', async () => {
    const validProgress = seedProgress[0];
    const malformedMissingField = { id: 'x', topicSlug: 'fastapi', exerciseId: 'ex9' };
    const malformedWrongType = { ...seedProgress[1], attempts: 'three' };
    const malformedBadStatus = { ...seedProgress[1], id: 'z', status: 'skipped' };

    const payload = wrap(4, {
      progress: [
        validProgress,
        malformedMissingField,
        malformedWrongType,
        malformedBadStatus,
      ] as ProgressRecord[],
    });

    const summary = await importProgress(payload);

    expect(summary.imported).toBe(1);
    expect(summary.skipped).toBe(3);

    const stored = await db.progress.toArray();
    expect(stored).toEqual([validProgress]);
  });

  it('skips a highlight with a color outside the allowed set', async () => {
    const goodHighlight = seedHighlights[0];
    const badHighlight = { ...seedHighlights[0], id: 'hl-bad', color: 'orange' };

    const payload = wrap(4, {
      highlights: [goodHighlight, badHighlight] as HighlightRecord[],
    });

    const summary = await importProgress(payload);

    expect(summary.imported).toBe(1);
    expect(summary.skipped).toBe(1);

    const stored = await db.highlights.toArray();
    expect(stored).toEqual([goodHighlight]);
  });
});

describe('importProgress version gating', () => {
  const achievement: AchievementRecord = {
    id: 'first-pass',
    unlockedAt: '2026-06-19T00:00:00.000Z',
  };
  const checkpoint: CheckpointResultRecord = {
    topicSlug: 'fastapi',
    conceptId: 'routing',
    status: 'pass',
    at: '2026-06-19T00:00:00.000Z',
  };

  it('drops v2+/v3+/v4 tables for a version 1 payload', async () => {
    const payload = wrap(1, {
      progress: seedProgress,
      achievements: [achievement],
      checkpointResults: [checkpoint],
      examResults: seedExamResults,
      userCards: seedUserCards,
    });

    const summary = await importProgress(payload);

    expect(summary.imported).toBe(seedProgress.length);
    expect(await db.progress.count()).toBe(seedProgress.length);
    expect(await db.achievements.count()).toBe(0);
    expect(await db.checkpointResults.count()).toBe(0);
    expect(await db.examResults.count()).toBe(0);
    expect(await db.userCards.count()).toBe(0);
  });

  it('drops userCards for a version below 4 but keeps v3 tables', async () => {
    const payload = wrap(3, {
      achievements: [achievement],
      checkpointResults: [checkpoint],
      examResults: seedExamResults,
      userCards: seedUserCards,
    });

    const summary = await importProgress(payload);

    expect(await db.achievements.count()).toBe(1);
    expect(await db.checkpointResults.count()).toBe(1);
    expect(await db.examResults.count()).toBe(seedExamResults.length);
    expect(await db.userCards.count()).toBe(0);

    expect(summary.imported).toBe(1 + 1 + seedExamResults.length);
  });

  it('imports userCards for a version 4 payload', async () => {
    const payload = wrap(4, { userCards: seedUserCards });

    const summary = await importProgress(payload);

    expect(summary.imported).toBe(seedUserCards.length);
    expect(await db.userCards.count()).toBe(seedUserCards.length);
  });
});
