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
  type ConfidenceLevel,
  type ExamResultRecord,
  type ExamScoreBucket,
  type FlashcardReviewRecord,
  type HighlightRecord,
  type InterviewStudiedRecord,
  type ProgressRecord,
  type ReExamScheduleRecord,
  type TopicPlaceRecord,
  type UserCardRecord,
} from './progress-db';
import { exportableSettings, importSettings, type AppSettingsBackup } from './settings';

export const PROGRESS_EXPORT_VERSION = 5;

// Reject oversized import files before reading/parsing them, so a crafted multi-hundred-MB
// "backup" cannot freeze the tab in JSON.parse or balloon IndexedDB. A real export of a heavy
// account is well under this.
export const MAX_IMPORT_FILE_BYTES = 16 * 1024 * 1024;

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
    reExamSchedule: ReExamScheduleRecord[];
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
    reExamSchedule,
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
    db.reExamSchedule.toArray(),
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
      reExamSchedule,
    },
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isString = (value: unknown): value is string => typeof value === 'string';

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

// An imported progress file is fully user-controlled and bulkPut straight into IndexedDB. Bound
// per-table record counts and free-text field lengths so a crafted/oversized "backup" cannot
// exhaust the origin's storage quota and wedge the local-first store. See also the file-size
// guard in the import handlers (ProgressPage / SettingsPage).
const MAX_RECORDS_PER_TABLE = 100_000;
const MAX_TEXT_FIELD_LENGTH = 20_000;

const isBoundedString = (value: unknown, max = MAX_TEXT_FIELD_LENGTH): value is string =>
  typeof value === 'string' && value.length <= max;

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
    if (valid.length >= MAX_RECORDS_PER_TABLE) {
      skipped += 1;
      continue;
    }
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
  isBoundedString(value.text) &&
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
  isBoundedString(value.text) &&
  isString(value.color) &&
  HIGHLIGHT_COLORS.has(value.color) &&
  isString(value.createdAt);

// A crafted/legacy backup may carry a garbage confidence value; rather than dropping the whole
// attempt/checkpoint record over one bad field, strip just that field before validating.
const CONFIDENCE_LEVELS = new Set(['sure', 'unsure', 'guess']);

const isConfidenceLevel = (value: unknown): value is ConfidenceLevel =>
  typeof value === 'string' && CONFIDENCE_LEVELS.has(value);

const stripInvalidConfidence = (value: unknown): unknown => {
  if (!isRecord(value) || !('confidence' in value)) return value;
  if (value.confidence === undefined || isConfidenceLevel(value.confidence)) return value;
  const { confidence: _dropped, ...rest } = value;
  return rest;
};

const normalizeEntries = (value: unknown, normalize: (entry: unknown) => unknown): unknown =>
  Array.isArray(value) ? value.map(normalize) : value;

const isAttemptEventRecord = (value: unknown): value is AttemptEventRecord =>
  isRecord(value) &&
  isString(value.topicSlug) &&
  isString(value.exerciseId) &&
  isString(value.concept) &&
  isString(value.difficulty) &&
  (value.status === 'pass' || value.status === 'fail') &&
  isString(value.at) &&
  (value.confidence === undefined || isConfidenceLevel(value.confidence));

const isAchievementRecord = (value: unknown): value is AchievementRecord =>
  isRecord(value) && isString(value.id) && isString(value.unlockedAt);

const CHECKPOINT_RESULT_SOURCES = new Set(['checkpoint', 'recall']);

const isCheckpointResultSource = (value: unknown): value is CheckpointResultRecord['source'] =>
  typeof value === 'string' && CHECKPOINT_RESULT_SOURCES.has(value);

const isNonNegativeNumber = (value: unknown): value is number => isNumber(value) && value >= 0;

// A crafted/legacy backup may carry a garbage source (or a negative/non-finite recalled/total);
// strip just those fields rather than dropping the whole checkpoint record, mirroring
// stripInvalidConfidence (which this also applies, so callers only need one normalize pass).
const stripInvalidCheckpointFields = (value: unknown): unknown => {
  const withValidConfidence = stripInvalidConfidence(value);
  if (!isRecord(withValidConfidence)) return withValidConfidence;
  let next = withValidConfidence;
  if ('source' in next && next.source !== undefined && !isCheckpointResultSource(next.source)) {
    const { source: _dropped, ...rest } = next;
    next = rest;
  }
  if ('recalled' in next && next.recalled !== undefined && !isNonNegativeNumber(next.recalled)) {
    const { recalled: _dropped, ...rest } = next;
    next = rest;
  }
  if ('total' in next && next.total !== undefined && !isNonNegativeNumber(next.total)) {
    const { total: _dropped, ...rest } = next;
    next = rest;
  }
  return next;
};

const isCheckpointResultRecord = (value: unknown): value is CheckpointResultRecord =>
  isRecord(value) &&
  isString(value.topicSlug) &&
  isString(value.conceptId) &&
  (value.status === 'pass' || value.status === 'fail') &&
  isString(value.at) &&
  (value.confidence === undefined || isConfidenceLevel(value.confidence)) &&
  (value.conceptTitle === undefined || isBoundedString(value.conceptTitle)) &&
  (value.source === undefined || isCheckpointResultSource(value.source)) &&
  (value.recalled === undefined || isNonNegativeNumber(value.recalled)) &&
  (value.total === undefined || isNonNegativeNumber(value.total));

const isReExamScheduleRecord = (value: unknown): value is ReExamScheduleRecord =>
  isRecord(value) &&
  isString(value.id) &&
  isString(value.topicSlug) &&
  isString(value.conceptId) &&
  isString(value.due) &&
  isNumber(value.stepIndex) &&
  isNumber(value.streak) &&
  (value.lastStatus === 'pass' || value.lastStatus === 'fail') &&
  typeof value.graduated === 'boolean' &&
  isString(value.updatedAt);

// Real exam breakdowns carry a handful of keys (one per type/difficulty); cap the entry count
// so a crafted backup cannot smuggle thousands of buckets into one examResults row.
const MAX_BUCKET_ENTRIES = 1_000;

const isExamScoreBuckets = (value: unknown): value is Record<string, ExamScoreBucket> => {
  if (!isRecord(value)) return false;
  const buckets = Object.values(value);
  if (buckets.length > MAX_BUCKET_ENTRIES) return false;
  return buckets.every(
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
  isBoundedString(value.front) &&
  isBoundedString(value.back) &&
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
    version >= 2
      ? collect(normalizeEntries(data.attemptEvents, stripInvalidConfidence), isAttemptEventRecord)
      : { valid: [], skipped: 0 };
  const achievements =
    version >= 2 ? collect(data.achievements, isAchievementRecord) : { valid: [], skipped: 0 };
  const checkpointResults =
    version >= 2
      ? collect(
          normalizeEntries(data.checkpointResults, stripInvalidCheckpointFields),
          isCheckpointResultRecord,
        )
      : { valid: [], skipped: 0 };
  const examResults =
    version >= 3 ? collect(data.examResults, isExamResultRecord) : { valid: [], skipped: 0 };
  const userCards =
    version >= 4 ? collect(data.userCards, isUserCardRecord) : { valid: [], skipped: 0 };
  const reExamSchedule =
    version >= 5 ? collect(data.reExamSchedule, isReExamScheduleRecord) : { valid: [], skipped: 0 };

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
      db.reExamSchedule,
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
      if (reExamSchedule.valid.length > 0) {
        await db.reExamSchedule.bulkPut(reExamSchedule.valid);
      }
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
    reExamSchedule,
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
      db.reExamSchedule,
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
        db.reExamSchedule.clear(),
      ]);
    },
  );
};

export const downloadProgressExport = (data: ProgressExport): void => {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `dotlearn-progress-${data.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
