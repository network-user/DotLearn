import {
  db,
  type AchievementRecord,
  type ActivityRecord,
  type AttemptEventRecord,
  type BookmarkRecord,
  type CheckpointResultRecord,
  type ConceptNoteRecord,
  type ConceptReadRecord,
  type ConceptScrollRecord,
  type ExamResultRecord,
  type ExamScoreBucket,
  type FlashcardReviewRecord,
  type HighlightRecord,
  type InterviewStudiedRecord,
  type ProgressRecord,
  type TopicPlaceRecord,
  type UserCardRecord,
} from './progress-db';
import { exportableSettings, importSettings, type AppSettingsBackup } from './settings';

export const PROGRESS_EXPORT_VERSION = 4;

export interface ProgressExport {
  app: 'dotlearn';
  kind: 'progress-export';
  version: number;
  exportedAt: string;
  settings?: AppSettingsBackup;
  data: {
    progress: ProgressRecord[];
    activity: ActivityRecord[];
    flashcardReviews: FlashcardReviewRecord[];
    interviewStudied: InterviewStudiedRecord[];
    topicPlace: TopicPlaceRecord[];
    conceptNotes: ConceptNoteRecord[];
    bookmarks: BookmarkRecord[];
    conceptRead: ConceptReadRecord[];
    conceptScroll: ConceptScrollRecord[];
    highlights: HighlightRecord[];
    attemptEvents: AttemptEventRecord[];
    achievements: AchievementRecord[];
    checkpointResults: CheckpointResultRecord[];
    examResults: ExamResultRecord[];
    userCards: UserCardRecord[];
  };
}

export class ProgressImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProgressImportError';
  }
}

export const exportProgress = async (): Promise<ProgressExport> => {
  const [
    progress,
    activity,
    flashcardReviews,
    interviewStudied,
    topicPlace,
    conceptNotes,
    bookmarks,
    conceptRead,
    conceptScroll,
    highlights,
    attemptEvents,
    achievements,
    checkpointResults,
    examResults,
    userCards,
  ] = await Promise.all([
    db.progress.toArray(),
    db.activity.toArray(),
    db.flashcardReviews.toArray(),
    db.interviewStudied.toArray(),
    db.topicPlace.toArray(),
    db.conceptNotes.toArray(),
    db.bookmarks.toArray(),
    db.conceptRead.toArray(),
    db.conceptScroll.toArray(),
    db.highlights.toArray(),
    db.attemptEvents.toArray(),
    db.achievements.toArray(),
    db.checkpointResults.toArray(),
    db.examResults.toArray(),
    db.userCards.toArray(),
  ]);

  return {
    app: 'dotlearn',
    kind: 'progress-export',
    version: PROGRESS_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    settings: exportableSettings(),
    data: {
      progress,
      activity,
      flashcardReviews,
      interviewStudied,
      topicPlace,
      conceptNotes,
      bookmarks,
      conceptRead,
      conceptScroll,
      highlights,
      attemptEvents,
      achievements,
      checkpointResults,
      examResults,
      userCards,
    },
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isString = (value: unknown): value is string => typeof value === 'string';

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

interface CollectResult<T> {
  valid: T[];
  skipped: number;
}

const collect = <T>(value: unknown, guard: (entry: unknown) => entry is T): CollectResult<T> => {
  if (!Array.isArray(value)) {
    return { valid: [], skipped: 0 };
  }
  const valid: T[] = [];
  let skipped = 0;
  for (const entry of value) {
    if (guard(entry)) {
      valid.push(entry);
    } else {
      skipped += 1;
    }
  }
  return { valid, skipped };
};

const isProgressRecord = (value: unknown): value is ProgressRecord =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.topicSlug) &&
  isString(value.exerciseId) &&
  (value.status === 'pass' || value.status === 'fail') &&
  isNumber(value.attempts) &&
  isString(value.lastAttemptAt);

const isActivityRecord = (value: unknown): value is ActivityRecord =>
  isRecord(value) &&
  isString(value.day) &&
  isNumber(value.exercisesAttempted) &&
  isNumber(value.exercisesPassed);

const isFlashcardReviewRecord = (value: unknown): value is FlashcardReviewRecord =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.topicSlug) &&
  isString(value.cardId) &&
  isString(value.due) &&
  isNumber(value.stability) &&
  isNumber(value.difficulty) &&
  isNumber(value.elapsedDays) &&
  isNumber(value.scheduledDays) &&
  isNumber(value.reps) &&
  isNumber(value.lapses) &&
  isNumber(value.state);

const isInterviewStudiedRecord = (value: unknown): value is InterviewStudiedRecord =>
  isRecord(value) && isNumber(value.id) && isString(value.studiedAt);

const isTopicPlaceRecord = (value: unknown): value is TopicPlaceRecord =>
  isRecord(value) &&
  isString(value.topicSlug) &&
  isString(value.conceptId) &&
  isString(value.updatedAt);

const isConceptNoteRecord = (value: unknown): value is ConceptNoteRecord =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.topicSlug) &&
  isString(value.conceptId) &&
  isString(value.text) &&
  isString(value.updatedAt);

const isBookmarkRecord = (value: unknown): value is BookmarkRecord =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.topicSlug) &&
  isString(value.conceptId) &&
  isString(value.createdAt);

const isConceptReadRecord = (value: unknown): value is ConceptReadRecord =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.topicSlug) &&
  isString(value.conceptId) &&
  isString(value.readAt);

const isConceptScrollRecord = (value: unknown): value is ConceptScrollRecord =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.topicSlug) &&
  isString(value.conceptId) &&
  isNumber(value.anchorOffset) &&
  isNumber(value.ratio) &&
  isString(value.updatedAt);

const HIGHLIGHT_COLORS = new Set(['yellow', 'green', 'blue', 'pink']);

const isHighlightRecord = (value: unknown): value is HighlightRecord =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.topicSlug) &&
  isString(value.conceptId) &&
  isString(value.text) &&
  isString(value.color) &&
  HIGHLIGHT_COLORS.has(value.color) &&
  isString(value.createdAt);

const isAttemptEventRecord = (value: unknown): value is AttemptEventRecord =>
  isRecord(value) &&
  isString(value.topicSlug) &&
  isString(value.exerciseId) &&
  isString(value.concept) &&
  isString(value.difficulty) &&
  (value.status === 'pass' || value.status === 'fail') &&
  isString(value.at);

const isAchievementRecord = (value: unknown): value is AchievementRecord =>
  isRecord(value) && isString(value.id) && isString(value.unlockedAt);

const isCheckpointResultRecord = (value: unknown): value is CheckpointResultRecord =>
  isRecord(value) &&
  isString(value.topicSlug) &&
  isString(value.conceptId) &&
  (value.status === 'pass' || value.status === 'fail') &&
  isString(value.at);

const isExamScoreBuckets = (value: unknown): value is Record<string, ExamScoreBucket> => {
  if (!isRecord(value)) return false;
  return Object.values(value).every(
    (bucket) => isRecord(bucket) && isNumber(bucket.total) && isNumber(bucket.correct),
  );
};

const isExamResultRecord = (value: unknown): value is ExamResultRecord =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.scope) &&
  isRecord(value.filters) &&
  isNumber(value.total) &&
  isNumber(value.correct) &&
  isExamScoreBuckets(value.byType) &&
  isExamScoreBuckets(value.byDifficulty) &&
  isNumber(value.durationMs) &&
  isString(value.startedAt) &&
  isString(value.finishedAt);

const isUserCardRecord = (value: unknown): value is UserCardRecord =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.front) &&
  isString(value.back) &&
  isString(value.topicSlug) &&
  isString(value.createdAt) &&
  (value.conceptId === undefined || isString(value.conceptId)) &&
  (value.sourceNoteId === undefined || isString(value.sourceNoteId)) &&
  (value.sourceHighlightId === undefined || isString(value.sourceHighlightId));

export interface ImportSummary {
  imported: number;
  skipped: number;
}

export const importProgress = async (raw: unknown): Promise<ImportSummary> => {
  if (typeof raw !== 'object' || raw === null) {
    throw new ProgressImportError('invalid-shape');
  }
  const payload = raw as Partial<ProgressExport>;
  if (
    payload.kind !== 'progress-export' ||
    typeof payload.data !== 'object' ||
    payload.data === null
  ) {
    throw new ProgressImportError('invalid-shape');
  }
  const version = typeof payload.version === 'number' ? payload.version : 1;
  const data = payload.data;

  if (version >= 3 && payload.settings) {
    importSettings(payload.settings);
  }

  const progress = collect(data.progress, isProgressRecord);
  const activity = collect(data.activity, isActivityRecord);
  const flashcardReviews = collect(data.flashcardReviews, isFlashcardReviewRecord);
  const interviewStudied = collect(data.interviewStudied, isInterviewStudiedRecord);
  const topicPlace = collect(data.topicPlace, isTopicPlaceRecord);
  const conceptNotes = collect(data.conceptNotes, isConceptNoteRecord);
  const bookmarks = collect(data.bookmarks, isBookmarkRecord);
  const conceptRead = collect(data.conceptRead, isConceptReadRecord);
  const conceptScroll = collect(data.conceptScroll, isConceptScrollRecord);
  const highlights = collect(data.highlights, isHighlightRecord);
  const attemptEvents =
    version >= 2 ? collect(data.attemptEvents, isAttemptEventRecord) : { valid: [], skipped: 0 };
  const achievements =
    version >= 2 ? collect(data.achievements, isAchievementRecord) : { valid: [], skipped: 0 };
  const checkpointResults =
    version >= 2
      ? collect(data.checkpointResults, isCheckpointResultRecord)
      : { valid: [], skipped: 0 };
  const examResults =
    version >= 3 ? collect(data.examResults, isExamResultRecord) : { valid: [], skipped: 0 };
  const userCards =
    version >= 4 ? collect(data.userCards, isUserCardRecord) : { valid: [], skipped: 0 };

  await db.transaction(
    'rw',
    [
      db.progress,
      db.activity,
      db.flashcardReviews,
      db.interviewStudied,
      db.topicPlace,
      db.conceptNotes,
      db.bookmarks,
      db.conceptRead,
      db.conceptScroll,
      db.highlights,
      db.attemptEvents,
      db.achievements,
      db.checkpointResults,
      db.examResults,
      db.userCards,
    ],
    async () => {
      await db.progress.bulkPut(progress.valid);
      await db.activity.bulkPut(activity.valid);
      await db.flashcardReviews.bulkPut(flashcardReviews.valid);
      await db.interviewStudied.bulkPut(interviewStudied.valid);
      await db.topicPlace.bulkPut(topicPlace.valid);
      await db.conceptNotes.bulkPut(conceptNotes.valid);
      await db.bookmarks.bulkPut(bookmarks.valid);
      await db.conceptRead.bulkPut(conceptRead.valid);
      await db.conceptScroll.bulkPut(conceptScroll.valid);
      await db.highlights.bulkPut(highlights.valid);
      if (attemptEvents.valid.length > 0) await db.attemptEvents.bulkPut(attemptEvents.valid);
      if (achievements.valid.length > 0) await db.achievements.bulkPut(achievements.valid);
      if (checkpointResults.valid.length > 0) {
        await db.checkpointResults.bulkPut(checkpointResults.valid);
      }
      if (examResults.valid.length > 0) await db.examResults.bulkPut(examResults.valid);
      if (userCards.valid.length > 0) await db.userCards.bulkPut(userCards.valid);
    },
  );

  const collected = [
    progress,
    activity,
    flashcardReviews,
    interviewStudied,
    topicPlace,
    conceptNotes,
    bookmarks,
    conceptRead,
    conceptScroll,
    highlights,
    attemptEvents,
    achievements,
    checkpointResults,
    examResults,
    userCards,
  ];

  const imported = collected.reduce((sum, result) => sum + result.valid.length, 0);
  const skipped = collected.reduce((sum, result) => sum + result.skipped, 0);

  if (skipped > 0) {
    console.warn(`Progress import dropped ${skipped} malformed record(s)`);
  }

  return { imported, skipped };
};

export const clearAllProgress = async (): Promise<void> => {
  await db.transaction(
    'rw',
    [
      db.progress,
      db.activity,
      db.flashcardReviews,
      db.interviewStudied,
      db.topicPlace,
      db.conceptNotes,
      db.bookmarks,
      db.conceptRead,
      db.conceptScroll,
      db.highlights,
      db.playground,
      db.attemptEvents,
      db.achievements,
      db.checkpointResults,
      db.examResults,
      db.userCards,
    ],
    async () => {
      await Promise.all([
        db.progress.clear(),
        db.activity.clear(),
        db.flashcardReviews.clear(),
        db.interviewStudied.clear(),
        db.topicPlace.clear(),
        db.conceptNotes.clear(),
        db.bookmarks.clear(),
        db.conceptRead.clear(),
        db.conceptScroll.clear(),
        db.highlights.clear(),
        db.playground.clear(),
        db.attemptEvents.clear(),
        db.achievements.clear(),
        db.checkpointResults.clear(),
        db.examResults.clear(),
        db.userCards.clear(),
      ]);
    },
  );
};

export const downloadProgressExport = (data: ProgressExport): void => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `dotlearn-progress-${data.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
