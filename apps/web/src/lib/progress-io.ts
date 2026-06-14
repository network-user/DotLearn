import {
  db,
  type ActivityRecord,
  type BookmarkRecord,
  type ConceptNoteRecord,
  type ConceptReadRecord,
  type ConceptScrollRecord,
  type FlashcardReviewRecord,
  type InterviewStudiedRecord,
  type ProgressRecord,
  type TopicPlaceRecord,
} from './progress-db';

export const PROGRESS_EXPORT_VERSION = 1;

export interface ProgressExport {
  app: 'dotlearn';
  kind: 'progress-export';
  version: number;
  exportedAt: string;
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
  ]);

  return {
    app: 'dotlearn',
    kind: 'progress-export',
    version: PROGRESS_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
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
    },
  };
};

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

export interface ImportSummary {
  imported: number;
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
  const data = payload.data;
  const progress = asArray<ProgressRecord>(data.progress);
  const activity = asArray<ActivityRecord>(data.activity);
  const flashcardReviews = asArray<FlashcardReviewRecord>(data.flashcardReviews);
  const interviewStudied = asArray<InterviewStudiedRecord>(data.interviewStudied);
  const topicPlace = asArray<TopicPlaceRecord>(data.topicPlace);
  const conceptNotes = asArray<ConceptNoteRecord>(data.conceptNotes);
  const bookmarks = asArray<BookmarkRecord>(data.bookmarks);
  const conceptRead = asArray<ConceptReadRecord>(data.conceptRead);
  const conceptScroll = asArray<ConceptScrollRecord>(data.conceptScroll);

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
    ],
    async () => {
      await db.progress.bulkPut(progress);
      await db.activity.bulkPut(activity);
      await db.flashcardReviews.bulkPut(flashcardReviews);
      await db.interviewStudied.bulkPut(interviewStudied);
      await db.topicPlace.bulkPut(topicPlace);
      await db.conceptNotes.bulkPut(conceptNotes);
      await db.bookmarks.bulkPut(bookmarks);
      await db.conceptRead.bulkPut(conceptRead);
      await db.conceptScroll.bulkPut(conceptScroll);
    },
  );

  const imported =
    progress.length +
    activity.length +
    flashcardReviews.length +
    interviewStudied.length +
    topicPlace.length +
    conceptNotes.length +
    bookmarks.length +
    conceptRead.length +
    conceptScroll.length;

  return { imported };
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
