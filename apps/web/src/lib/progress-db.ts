import type { ProviderId } from '@dotlearn/ai-providers';
import Dexie, { type Table } from 'dexie';

export type ProgressStatus = 'pass' | 'fail';

export interface ProviderCredentialsRecord {
  providerId: ProviderId;
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
  updatedAt: string;
}

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

export interface CryptoKeyRecord {
  id: string;
  key: CryptoKey;
}

class ProgressDb extends Dexie {
  progress!: Table<ProgressRecord, string>;
  activity!: Table<ActivityRecord, string>;
  flashcardReviews!: Table<FlashcardReviewRecord, string>;
  providerCredentials!: Table<ProviderCredentialsRecord, string>;
  interviewStudied!: Table<InterviewStudiedRecord, number>;
  cryptoKeys!: Table<CryptoKeyRecord, string>;

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
  }
}

export const db = new ProgressDb();

export const INTERVIEW_TOPIC_SLUG = 'interview';

export const setInterviewStudied = async (
  id: number,
  studied: boolean,
): Promise<void> => {
  await db.transaction('rw', db.interviewStudied, db.activity, async () => {
    const existing = await db.interviewStudied.get(id);
    if (studied) {
      if (existing) return;
      const now = new Date();
      await db.interviewStudied.put({ id, studiedAt: now.toISOString() });
      const day = now.toISOString().slice(0, 10);
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

const todayUtc = (): string => new Date().toISOString().slice(0, 10);

const progressKey = (topicSlug: string, exerciseId: string): string =>
  `${topicSlug}:${exerciseId}`;

export const recordAttempt = async (
  topicSlug: string,
  exerciseId: string,
  status: ProgressStatus,
): Promise<void> => {
  const id = progressKey(topicSlug, exerciseId);
  const day = todayUtc();
  const now = new Date().toISOString();

  await db.transaction('rw', db.progress, db.activity, async () => {
    const existing = await db.progress.get(id);
    const nextStatus: ProgressStatus =
      existing?.status === 'pass' ? 'pass' : status;
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
  });
};
