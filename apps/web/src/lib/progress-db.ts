import Dexie, { type Table } from 'dexie';

import {
  scheduleReExam,
  shouldScheduleFreeRecallReExam,
  type ConfidenceLevel,
  type ReExamState,
} from '@dotlearn/lesson-engine';

import { base64ByteLength } from './sync/codec';

export type { ConfidenceLevel };

export type ProgressStatus = 'pass' | 'fail';

export interface ProgressRecord {
  id: string;
  topicSlug: string;
  exerciseId: string;
  status: ProgressStatus;
  attempts: number;
  lastAttemptAt: string;
}

export interface ActivityRecord {
  day: string;
  exercisesAttempted: number;
  exercisesPassed: number;
  interviewStudied?: number;
  cardsReviewed?: number;
  conceptsRead?: number;
  focusBlocks?: number;
}

export interface FlashcardReviewRecord {
  id: string;
  topicSlug: string;
  cardId: string;
  due: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: number;
  lastReviewAt?: string;
}

export interface InterviewStudiedRecord {
  id: number;
  studiedAt: string;
}

export interface TopicPlaceRecord {
  topicSlug: string;
  conceptId: string;
  updatedAt: string;
}

export interface ConceptNoteRecord {
  id: string;
  topicSlug: string;
  conceptId: string;
  text: string;
  updatedAt: string;
  tags?: string[];
}

export interface BookmarkRecord {
  id: string;
  topicSlug: string;
  conceptId: string;
  createdAt: string;
  tags?: string[];
}

export interface ConceptReadRecord {
  id: string;
  topicSlug: string;
  conceptId: string;
  readAt: string;
}

export interface PlaygroundRecord {
  id: string;
  value: string;
  updatedAt: string;
}

export type PlaygroundSnippetLanguage = 'python';

export interface PlaygroundSnippetRecord {
  id: string;
  language: PlaygroundSnippetLanguage;
  name: string;
  code: string;
  updatedAt: string;
}

export interface ConceptScrollRecord {
  id: string;
  topicSlug: string;
  conceptId: string;
  anchorId?: string;
  anchorOffset: number;
  ratio: number;
  updatedAt: string;
}

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink';

export interface HighlightRecord {
  id: string;
  topicSlug: string;
  conceptId: string;
  text: string;
  color: HighlightColor;
  note?: string;
  prefix?: string;
  suffix?: string;
  createdAt: string;
}

export interface UserCardRecord {
  id: string;
  front: string;
  back: string;
  topicSlug: string;
  conceptId?: string;
  sourceNoteId?: string;
  sourceHighlightId?: string;
  createdAt: string;
}

export type AttemptEventStatus = 'pass' | 'fail';

export interface AttemptEventRecord {
  id?: number;
  topicSlug: string;
  exerciseId: string;
  concept: string;
  difficulty: string;
  status: AttemptEventStatus;
  hintsRevealed?: number;
  durationMs?: number;
  mode?: string;
  confidence?: ConfidenceLevel;
  at: string;
}

export interface AchievementRecord {
  id: string;
  unlockedAt: string;
}

export type CheckpointResultStatus = 'pass' | 'fail';

// Absent `source` means 'checkpoint' (pre-existing records predate this field).
export type CheckpointResultSource = 'checkpoint' | 'recall';

export interface CheckpointResultRecord {
  id?: number;
  topicSlug: string;
  conceptId: string;
  status: CheckpointResultStatus;
  confidence?: ConfidenceLevel;
  conceptTitle?: string;
  source?: CheckpointResultSource;
  recalled?: number; // only set when source === 'recall'
  total?: number; // only set when source === 'recall'
  at: string;
}

export interface ExamScoreBucket {
  total: number;
  correct: number;
}

export interface ExamResultRecord {
  id: string;
  scope: string;
  filters: Record<string, string>;
  total: number;
  correct: number;
  byType: Record<string, ExamScoreBucket>;
  byDifficulty: Record<string, ExamScoreBucket>;
  durationMs: number;
  startedAt: string;
  finishedAt: string;
}

export interface ReExamScheduleRecord {
  id: string; // `${topicSlug}:${conceptId}`
  topicSlug: string;
  conceptId: string;
  due: string; // ISO
  stepIndex: number;
  streak: number;
  lastStatus: 'pass' | 'fail';
  graduated: boolean;
  updatedAt: string;
}

// Local backups of the full progress snapshot, taken before cross-device sync applies a merged
// snapshot that would change records (see apps/web/src/lib/sync/). `payload` is base64(gzip) of a
// ProgressExport, produced by the sync engine via codec.ts.
export type SyncBackupReason = 'link' | 'pre-apply' | 'manual';

export interface SyncBackupRecord {
  id?: number;
  createdAt: number;
  reason: SyncBackupReason;
  hash: string;
  sizeBytes: number;
  payload: string;
}

class ProgressDb extends Dexie {
  progress!: Table<ProgressRecord, string>;
  activity!: Table<ActivityRecord, string>;
  flashcardReviews!: Table<FlashcardReviewRecord, string>;
  interviewStudied!: Table<InterviewStudiedRecord, number>;
  topicPlace!: Table<TopicPlaceRecord, string>;
  conceptNotes!: Table<ConceptNoteRecord, string>;
  bookmarks!: Table<BookmarkRecord, string>;
  conceptRead!: Table<ConceptReadRecord, string>;
  playground!: Table<PlaygroundRecord, string>;
  conceptScroll!: Table<ConceptScrollRecord, string>;
  highlights!: Table<HighlightRecord, string>;
  attemptEvents!: Table<AttemptEventRecord, number>;
  achievements!: Table<AchievementRecord, string>;
  checkpointResults!: Table<CheckpointResultRecord, number>;
  examResults!: Table<ExamResultRecord, string>;
  userCards!: Table<UserCardRecord, string>;
  playgroundSnippets!: Table<PlaygroundSnippetRecord, string>;
  reExamSchedule!: Table<ReExamScheduleRecord, string>;
  syncBackups!: Table<SyncBackupRecord, number>;

  constructor() {
    super('dotlearn-progress');
    this.version(1).stores({
      progress: 'id, topicSlug, status',
      activity: 'day',
      flashcardReviews: 'id, topicSlug, due',
    });
    this.version(2).stores({
      progress: 'id, topicSlug, status',
      activity: 'day',
      flashcardReviews: 'id, topicSlug, due',
      providerCredentials: 'providerId',
    });
    this.version(3).stores({
      progress: 'id, topicSlug, status',
      activity: 'day',
      flashcardReviews: 'id, topicSlug, due',
      providerCredentials: 'providerId',
      interviewStudied: 'id',
    });
    this.version(4).stores({
      progress: 'id, topicSlug, status',
      activity: 'day',
      flashcardReviews: 'id, topicSlug, due',
      providerCredentials: 'providerId',
      interviewStudied: 'id',
      cryptoKeys: 'id',
    });
    this.version(5).stores({
      progress: 'id, topicSlug, status',
      activity: 'day',
      flashcardReviews: 'id, topicSlug, due',
      providerCredentials: 'providerId',
      interviewStudied: 'id',
      cryptoKeys: 'id',
      topicPlace: 'topicSlug, updatedAt',
      conceptNotes: 'id, topicSlug',
      bookmarks: 'id, topicSlug, createdAt',
    });
    this.version(6).stores({
      progress: 'id, topicSlug, status',
      activity: 'day',
      flashcardReviews: 'id, topicSlug, due',
      providerCredentials: 'providerId',
      interviewStudied: 'id',
      cryptoKeys: 'id',
      topicPlace: 'topicSlug, updatedAt',
      conceptNotes: 'id, topicSlug',
      bookmarks: 'id, topicSlug, createdAt',
      conceptRead: 'id, topicSlug',
    });
    this.version(7).stores({
      progress: 'id, topicSlug, status',
      activity: 'day',
      flashcardReviews: 'id, topicSlug, due',
      providerCredentials: 'providerId',
      interviewStudied: 'id',
      cryptoKeys: 'id',
      topicPlace: 'topicSlug, updatedAt',
      conceptNotes: 'id, topicSlug',
      bookmarks: 'id, topicSlug, createdAt',
      conceptRead: 'id, topicSlug',
      playground: 'id',
    });
    this.version(8).stores({
      progress: 'id, topicSlug, status',
      activity: 'day',
      flashcardReviews: 'id, topicSlug, due',
      providerCredentials: 'providerId',
      interviewStudied: 'id',
      cryptoKeys: 'id',
      topicPlace: 'topicSlug, updatedAt',
      conceptNotes: 'id, topicSlug',
      bookmarks: 'id, topicSlug, createdAt',
      conceptRead: 'id, topicSlug',
      playground: 'id',
      conceptScroll: 'id, topicSlug',
    });
    this.version(9).stores({
      progress: 'id, topicSlug, status',
      activity: 'day',
      flashcardReviews: 'id, topicSlug, due',
      providerCredentials: 'providerId',
      interviewStudied: 'id',
      cryptoKeys: 'id',
      topicPlace: 'topicSlug, updatedAt',
      conceptNotes: 'id, topicSlug',
      bookmarks: 'id, topicSlug, createdAt',
      conceptRead: 'id, topicSlug',
      playground: 'id',
      conceptScroll: 'id, topicSlug',
      highlights: 'id, topicSlug, conceptId, createdAt, [topicSlug+conceptId]',
    });
    this.version(10).stores({
      progress: 'id, topicSlug, status',
      activity: 'day',
      flashcardReviews: 'id, topicSlug, due',
      providerCredentials: 'providerId',
      interviewStudied: 'id',
      cryptoKeys: 'id',
      topicPlace: 'topicSlug, updatedAt',
      conceptNotes: 'id, topicSlug',
      bookmarks: 'id, topicSlug, createdAt',
      conceptRead: 'id, topicSlug',
      playground: 'id',
      conceptScroll: 'id, topicSlug',
      highlights: 'id, topicSlug, conceptId, createdAt, [topicSlug+conceptId]',
      attemptEvents: '++id, topicSlug, exerciseId, concept, status, at, [topicSlug+at]',
      achievements: 'id, unlockedAt',
      checkpointResults: '++id, topicSlug, conceptId, status, at, [topicSlug+conceptId]',
    });
    this.version(11).stores({
      progress: 'id, topicSlug, status',
      activity: 'day',
      flashcardReviews: 'id, topicSlug, due',
      providerCredentials: 'providerId',
      interviewStudied: 'id',
      cryptoKeys: 'id',
      topicPlace: 'topicSlug, updatedAt',
      conceptNotes: 'id, topicSlug',
      bookmarks: 'id, topicSlug, createdAt',
      conceptRead: 'id, topicSlug',
      playground: 'id',
      conceptScroll: 'id, topicSlug',
      highlights: 'id, topicSlug, conceptId, createdAt, [topicSlug+conceptId]',
      attemptEvents: '++id, topicSlug, exerciseId, concept, status, at, [topicSlug+at]',
      achievements: 'id, unlockedAt',
      checkpointResults: '++id, topicSlug, conceptId, status, at, [topicSlug+conceptId]',
      examResults: 'id, scope, finishedAt',
    });
    this.version(12).stores({
      progress: 'id, topicSlug, status',
      activity: 'day',
      flashcardReviews: 'id, topicSlug, due',
      providerCredentials: 'providerId',
      interviewStudied: 'id',
      cryptoKeys: 'id',
      topicPlace: 'topicSlug, updatedAt',
      conceptNotes: 'id, topicSlug',
      bookmarks: 'id, topicSlug, createdAt',
      conceptRead: 'id, topicSlug',
      playground: 'id',
      conceptScroll: 'id, topicSlug',
      highlights: 'id, topicSlug, conceptId, createdAt, [topicSlug+conceptId]',
      attemptEvents: '++id, topicSlug, exerciseId, concept, status, at, [topicSlug+at]',
      achievements: 'id, unlockedAt',
      checkpointResults: '++id, topicSlug, conceptId, status, at, [topicSlug+conceptId]',
      examResults: 'id, scope, finishedAt',
      userCards: 'id, topicSlug, createdAt, sourceNoteId, sourceHighlightId',
    });
    this.version(13).stores({
      progress: 'id, topicSlug, status',
      activity: 'day',
      flashcardReviews: 'id, topicSlug, due',
      providerCredentials: 'providerId',
      interviewStudied: 'id',
      cryptoKeys: 'id',
      topicPlace: 'topicSlug, updatedAt',
      conceptNotes: 'id, topicSlug',
      bookmarks: 'id, topicSlug, createdAt',
      conceptRead: 'id, topicSlug',
      playground: 'id',
      conceptScroll: 'id, topicSlug',
      highlights: 'id, topicSlug, conceptId, createdAt, [topicSlug+conceptId]',
      attemptEvents: '++id, topicSlug, exerciseId, concept, status, at, [topicSlug+at]',
      achievements: 'id, unlockedAt',
      checkpointResults: '++id, topicSlug, conceptId, status, at, [topicSlug+conceptId]',
      examResults: 'id, scope, finishedAt',
      userCards: 'id, topicSlug, createdAt, sourceNoteId, sourceHighlightId',
      playgroundSnippets: 'id, language, updatedAt',
    });
    // Drop the dead BYOK stores: the live site is pure-logic with no runtime AI, so the
    // provider-credentials/crypto-key tables (and their helpers) were removed. This cleans up
    // the obsolete stores from existing visitors' IndexedDB rather than leaving them orphaned.
    this.version(14).stores({
      providerCredentials: null,
      cryptoKeys: null,
    });
    // Confidence calibration + spaced re-exam scheduling data.
    this.version(15).stores({
      reExamSchedule: 'id, topicSlug, conceptId, due, [topicSlug+conceptId]',
    });
    // Index conceptNotes by updatedAt so the Library page can list notes newest-first
    // (db.conceptNotes.orderBy('updatedAt') threw "KeyPath updatedAt ... is not indexed").
    this.version(16).stores({
      conceptNotes: 'id, topicSlug, updatedAt',
    });
    // Cross-device sync: local pre-apply/manual backups of the full progress snapshot.
    this.version(17).stores({
      syncBackups: '++id, createdAt',
    });
  }
}

export const db = new ProgressDb();

export const INTERVIEW_TOPIC_SLUG = 'interview';

export const USER_CARDS_DECK_SLUG = 'library:notes';

export const localDayKey = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const setInterviewStudied = async (id: number, studied: boolean): Promise<void> => {
  await db.transaction('rw', db.interviewStudied, db.activity, async () => {
    const existing = await db.interviewStudied.get(id);
    if (studied) {
      if (existing) return;
      const now = new Date();
      await db.interviewStudied.put({ id, studiedAt: now.toISOString() });
      const day = localDayKey(now);
      const activity = await db.activity.get(day);
      await db.activity.put({
        day,
        exercisesAttempted: activity?.exercisesAttempted ?? 0,
        exercisesPassed: activity?.exercisesPassed ?? 0,
        interviewStudied: (activity?.interviewStudied ?? 0) + 1,
      });
    } else {
      await db.interviewStudied.delete(id);
    }
  });
};

const progressKey = (topicSlug: string, exerciseId: string): string => `${topicSlug}:${exerciseId}`;

export interface RecordAttemptMeta {
  difficulty?: number | undefined;
  concept?: string | undefined;
  hintsRevealed?: number | undefined;
  durationMs?: number | undefined;
  mode?: string | undefined;
  confidence?: ConfidenceLevel | undefined;
}

const ATTEMPT_EVENT_CAP = 4000;

const pruneAttemptEvents = async (): Promise<void> => {
  const count = await db.attemptEvents.count();
  if (count <= ATTEMPT_EVENT_CAP) return;
  const oldest = await db.attemptEvents
    .orderBy('id')
    .limit(count - ATTEMPT_EVENT_CAP)
    .primaryKeys();
  if (oldest.length > 0) await db.attemptEvents.bulkDelete(oldest);
};

export const recordAttempt = async (
  topicSlug: string,
  exerciseId: string,
  status: ProgressStatus,
  meta: RecordAttemptMeta = {},
): Promise<void> => {
  const id = progressKey(topicSlug, exerciseId);
  const day = localDayKey();
  const now = new Date().toISOString();

  await db.transaction('rw', db.progress, db.activity, db.attemptEvents, async () => {
    const existing = await db.progress.get(id);
    const nextStatus: ProgressStatus = existing?.status === 'pass' ? 'pass' : status;
    await db.progress.put({
      id,
      topicSlug,
      exerciseId,
      status: nextStatus,
      attempts: (existing?.attempts ?? 0) + 1,
      lastAttemptAt: now,
    });

    const activity = await db.activity.get(day);
    const wasPassedBefore = existing?.status === 'pass';
    const becomesPassed = !wasPassedBefore && status === 'pass';
    await db.activity.put({
      day,
      exercisesAttempted: (activity?.exercisesAttempted ?? 0) + 1,
      exercisesPassed: (activity?.exercisesPassed ?? 0) + (becomesPassed ? 1 : 0),
    });

    await db.attemptEvents.add({
      topicSlug,
      exerciseId,
      concept: meta.concept ?? '',
      difficulty: meta.difficulty === undefined ? '' : String(meta.difficulty),
      status,
      ...(meta.hintsRevealed !== undefined ? { hintsRevealed: meta.hintsRevealed } : {}),
      ...(meta.durationMs !== undefined ? { durationMs: meta.durationMs } : {}),
      ...(meta.mode !== undefined ? { mode: meta.mode } : {}),
      ...(meta.confidence !== undefined ? { confidence: meta.confidence } : {}),
      at: now,
    });
  });

  void pruneAttemptEvents();
};

const reExamKey = (topicSlug: string, conceptId: string): string => `${topicSlug}:${conceptId}`;

const upsertReExamSchedule = async (
  topicSlug: string,
  conceptId: string,
  passed: boolean,
  now: Date,
  prev?: ReExamState,
): Promise<void> => {
  const id = reExamKey(topicSlug, conceptId);
  const schedule = scheduleReExam(prev, passed, now);
  await db.reExamSchedule.put({
    id,
    topicSlug,
    conceptId,
    due: schedule.due,
    stepIndex: schedule.stepIndex,
    streak: schedule.streak,
    lastStatus: schedule.lastStatus,
    graduated: schedule.graduated,
    updatedAt: now.toISOString(),
  });
};

interface WriteCheckpointOutcomeExtra {
  conceptTitle?: string;
  confidence?: ConfidenceLevel;
  source?: CheckpointResultSource;
  recalled?: number;
  total?: number;
  // Decides whether this outcome should move the re-exam ladder. Defaults to "always schedule",
  // which is the checkpoint/re-exam behavior. Free recall passes a stricter rule instead.
  shouldScheduleReExam?: (prev: ReExamState | undefined, passed: boolean) => boolean;
}

const writeCheckpointOutcome = async (
  topicSlug: string,
  conceptId: string,
  status: CheckpointResultStatus,
  extra: WriteCheckpointOutcomeExtra = {},
): Promise<{ scheduled: boolean }> => {
  const now = new Date();
  const passed = status === 'pass';
  return db.transaction('rw', db.checkpointResults, db.reExamSchedule, async () => {
    await db.checkpointResults.add({
      topicSlug,
      conceptId,
      status,
      at: now.toISOString(),
      ...(extra.conceptTitle !== undefined ? { conceptTitle: extra.conceptTitle } : {}),
      ...(extra.confidence !== undefined ? { confidence: extra.confidence } : {}),
      ...(extra.source !== undefined ? { source: extra.source } : {}),
      ...(extra.recalled !== undefined ? { recalled: extra.recalled } : {}),
      ...(extra.total !== undefined ? { total: extra.total } : {}),
    });

    const prev = await db.reExamSchedule.get(reExamKey(topicSlug, conceptId));
    const scheduled = extra.shouldScheduleReExam ? extra.shouldScheduleReExam(prev, passed) : true;
    if (scheduled) {
      await upsertReExamSchedule(topicSlug, conceptId, passed, now, prev);
    }
    return { scheduled };
  });
};

export const recordCheckpointResult = async (input: {
  topicSlug: string;
  conceptId: string;
  conceptTitle?: string;
  status: CheckpointResultStatus;
  confidence?: ConfidenceLevel;
}): Promise<void> => {
  await writeCheckpointOutcome(input.topicSlug, input.conceptId, input.status, {
    ...(input.conceptTitle !== undefined ? { conceptTitle: input.conceptTitle } : {}),
    ...(input.confidence !== undefined ? { confidence: input.confidence } : {}),
  });
};

export const recordReExamResult = async (
  topicSlug: string,
  conceptId: string,
  passed: boolean,
): Promise<void> => {
  await writeCheckpointOutcome(topicSlug, conceptId, passed ? 'pass' : 'fail');
};

export const recordFreeRecallResult = async (input: {
  topicSlug: string;
  conceptId: string;
  conceptTitle?: string;
  status: 'pass' | 'fail';
  confidence?: ConfidenceLevel;
  recalled: number;
  total: number;
}): Promise<{ scheduled: boolean }> =>
  writeCheckpointOutcome(input.topicSlug, input.conceptId, input.status, {
    ...(input.conceptTitle !== undefined ? { conceptTitle: input.conceptTitle } : {}),
    ...(input.confidence !== undefined ? { confidence: input.confidence } : {}),
    source: 'recall',
    recalled: input.recalled,
    total: input.total,
    shouldScheduleReExam: shouldScheduleFreeRecallReExam,
  });

export type StudyActivityKind = 'review' | 'read' | 'focus';

const ACTIVITY_COUNTER: Record<
  StudyActivityKind,
  'cardsReviewed' | 'conceptsRead' | 'focusBlocks'
> = {
  review: 'cardsReviewed',
  read: 'conceptsRead',
  focus: 'focusBlocks',
};

export const recordStudyActivity = async (kind: StudyActivityKind, count = 1): Promise<void> => {
  const day = localDayKey();
  const counter = ACTIVITY_COUNTER[kind];
  await db.transaction('rw', db.activity, async () => {
    const activity = await db.activity.get(day);
    await db.activity.put({
      day,
      exercisesAttempted: activity?.exercisesAttempted ?? 0,
      exercisesPassed: activity?.exercisesPassed ?? 0,
      ...(activity?.interviewStudied !== undefined
        ? { interviewStudied: activity.interviewStudied }
        : {}),
      ...(activity?.cardsReviewed !== undefined ? { cardsReviewed: activity.cardsReviewed } : {}),
      ...(activity?.conceptsRead !== undefined ? { conceptsRead: activity.conceptsRead } : {}),
      ...(activity?.focusBlocks !== undefined ? { focusBlocks: activity.focusBlocks } : {}),
      [counter]: (activity?.[counter] ?? 0) + count,
    });
  });
};

export const persistAchievementUnlocks = async (
  unlockedIds: readonly string[],
): Promise<{ newlyUnlocked: string[] }> => {
  if (unlockedIds.length === 0) return { newlyUnlocked: [] };
  return db.transaction('rw', db.achievements, async () => {
    const existing = new Set((await db.achievements.toArray()).map((record) => record.id));
    const toAdd = unlockedIds.filter((id) => !existing.has(id));
    if (toAdd.length === 0) return { newlyUnlocked: [] };
    const unlockedAt = new Date().toISOString();
    await db.achievements.bulkPut(toAdd.map((id) => ({ id, unlockedAt })));
    return { newlyUnlocked: toAdd };
  });
};

const placeKey = (topicSlug: string, conceptId: string): string => `${topicSlug}:${conceptId}`;

export const recordPlace = async (topicSlug: string, conceptId: string): Promise<void> => {
  await db.topicPlace.put({
    topicSlug,
    conceptId,
    updatedAt: new Date().toISOString(),
  });
};

export const saveConceptNote = async (
  topicSlug: string,
  conceptId: string,
  text: string,
): Promise<void> => {
  const id = placeKey(topicSlug, conceptId);
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    await db.conceptNotes.delete(id);
    return;
  }
  const existing = await db.conceptNotes.get(id);
  await db.conceptNotes.put({
    id,
    topicSlug,
    conceptId,
    text,
    updatedAt: new Date().toISOString(),
    ...(existing?.tags && existing.tags.length > 0 ? { tags: existing.tags } : {}),
  });
};

export const setBookmark = async (
  topicSlug: string,
  conceptId: string,
  bookmarked: boolean,
): Promise<void> => {
  const id = placeKey(topicSlug, conceptId);
  if (bookmarked) {
    const existing = await db.bookmarks.get(id);
    if (existing) return;
    await db.bookmarks.put({
      id,
      topicSlug,
      conceptId,
      createdAt: new Date().toISOString(),
    });
  } else {
    await db.bookmarks.delete(id);
  }
};

const normalizeTags = (tags: readonly string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of tags) {
    const trimmed = raw.trim();
    if (trimmed.length === 0) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
};

export const setNoteTags = async (id: string, tags: readonly string[]): Promise<void> => {
  const normalized = normalizeTags(tags);
  const record = await db.conceptNotes.get(id);
  if (!record) return;
  const next: ConceptNoteRecord = { ...record };
  if (normalized.length > 0) {
    next.tags = normalized;
  } else {
    delete next.tags;
  }
  await db.conceptNotes.put(next);
};

export const setBookmarkTags = async (id: string, tags: readonly string[]): Promise<void> => {
  const normalized = normalizeTags(tags);
  const record = await db.bookmarks.get(id);
  if (!record) return;
  const next: BookmarkRecord = { ...record };
  if (normalized.length > 0) {
    next.tags = normalized;
  } else {
    delete next.tags;
  }
  await db.bookmarks.put(next);
};

export const setConceptRead = async (
  topicSlug: string,
  conceptId: string,
  read: boolean,
): Promise<void> => {
  const id = placeKey(topicSlug, conceptId);
  if (read) {
    const existing = await db.conceptRead.get(id);
    if (existing) return;
    await db.conceptRead.put({
      id,
      topicSlug,
      conceptId,
      readAt: new Date().toISOString(),
    });
    await recordStudyActivity('read');
  } else {
    await db.conceptRead.delete(id);
  }
};

export interface ScrollPosition {
  anchorId?: string;
  anchorOffset: number;
  ratio: number;
}

export const recordScroll = async (
  topicSlug: string,
  conceptId: string,
  position: ScrollPosition,
): Promise<void> => {
  await db.conceptScroll.put({
    id: placeKey(topicSlug, conceptId),
    topicSlug,
    conceptId,
    anchorOffset: position.anchorOffset,
    ratio: position.ratio,
    updatedAt: new Date().toISOString(),
    ...(position.anchorId ? { anchorId: position.anchorId } : {}),
  });
};

export const getScroll = async (
  topicSlug: string,
  conceptId: string,
): Promise<ConceptScrollRecord | undefined> => db.conceptScroll.get(placeKey(topicSlug, conceptId));

export const deleteScroll = async (topicSlug: string, conceptId: string): Promise<void> => {
  await db.conceptScroll.delete(placeKey(topicSlug, conceptId));
};

const newHighlightId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `h-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;

export interface HighlightInput {
  topicSlug: string;
  conceptId: string;
  text: string;
  color: HighlightColor;
  note?: string;
  prefix?: string;
  suffix?: string;
}

export const addHighlight = async (input: HighlightInput): Promise<HighlightRecord> => {
  const record: HighlightRecord = {
    id: newHighlightId(),
    topicSlug: input.topicSlug,
    conceptId: input.conceptId,
    text: input.text,
    color: input.color,
    createdAt: new Date().toISOString(),
    ...(input.note && input.note.trim().length > 0 ? { note: input.note.trim() } : {}),
    ...(input.prefix && input.prefix.length > 0 ? { prefix: input.prefix } : {}),
    ...(input.suffix && input.suffix.length > 0 ? { suffix: input.suffix } : {}),
  };
  await db.highlights.put(record);
  return record;
};

export const removeHighlight = async (id: string): Promise<void> => {
  await db.highlights.delete(id);
};

export const setHighlightColor = async (id: string, color: HighlightColor): Promise<void> => {
  await db.highlights.update(id, { color });
};

export const setHighlightNote = async (id: string, note: string): Promise<void> => {
  const trimmed = note.trim();
  if (trimmed.length > 0) {
    await db.highlights.update(id, { note: trimmed });
    return;
  }
  const record = await db.highlights.get(id);
  if (!record) return;
  const next: HighlightRecord = { ...record };
  delete next.note;
  await db.highlights.put(next);
};

const newExamResultId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `exam-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;

export interface ExamResultInput {
  scope: string;
  filters: Record<string, string>;
  total: number;
  correct: number;
  byType: Record<string, ExamScoreBucket>;
  byDifficulty: Record<string, ExamScoreBucket>;
  durationMs: number;
  startedAt: string;
  finishedAt: string;
}

export const recordExamResult = async (input: ExamResultInput): Promise<ExamResultRecord> => {
  const record: ExamResultRecord = { id: newExamResultId(), ...input };
  await db.examResults.put(record);
  return record;
};

const newUserCardId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `uc-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;

export interface UserCardInput {
  front: string;
  back: string;
  topicSlug: string;
  conceptId?: string;
  sourceNoteId?: string;
  sourceHighlightId?: string;
}

export const createUserCard = async (input: UserCardInput): Promise<UserCardRecord> => {
  const record: UserCardRecord = {
    id: newUserCardId(),
    front: input.front.trim(),
    back: input.back.trim(),
    topicSlug: input.topicSlug,
    createdAt: new Date().toISOString(),
    ...(input.conceptId ? { conceptId: input.conceptId } : {}),
    ...(input.sourceNoteId ? { sourceNoteId: input.sourceNoteId } : {}),
    ...(input.sourceHighlightId ? { sourceHighlightId: input.sourceHighlightId } : {}),
  };
  await db.userCards.put(record);
  return record;
};

export const deleteUserCard = async (id: string): Promise<void> => {
  await db.transaction('rw', db.userCards, db.flashcardReviews, async () => {
    await db.userCards.delete(id);
    await db.flashcardReviews.delete(`${USER_CARDS_DECK_SLUG}:${id}`);
  });
};

// --- Cross-device sync backups ---
//
// Local safety net taken before the sync engine applies a merged remote snapshot: link-time and
// pre-apply snapshots let a user recover if a merge ever looks wrong. Keep only the newest few;
// dedup by hash so an idle device pushing/pulling identical state doesn't pile up duplicates.
const SYNC_BACKUP_KEEP = 3;

export const saveSyncBackup = async (
  reason: SyncBackupReason,
  hash: string,
  payload: string,
): Promise<void> => {
  await db.transaction('rw', db.syncBackups, async () => {
    const newest = await db.syncBackups.orderBy('createdAt').last();
    if (newest?.hash === hash) return;

    await db.syncBackups.add({
      createdAt: Date.now(),
      reason,
      hash,
      sizeBytes: base64ByteLength(payload),
      payload,
    });

    const count = await db.syncBackups.count();
    if (count > SYNC_BACKUP_KEEP) {
      const stale = await db.syncBackups
        .orderBy('createdAt')
        .limit(count - SYNC_BACKUP_KEEP)
        .primaryKeys();
      if (stale.length > 0) await db.syncBackups.bulkDelete(stale);
    }
  });
};

export const listSyncBackups = async (): Promise<SyncBackupRecord[]> =>
  db.syncBackups.orderBy('createdAt').reverse().toArray();

export const getSyncBackup = async (id: number): Promise<SyncBackupRecord | undefined> =>
  db.syncBackups.get(id);
