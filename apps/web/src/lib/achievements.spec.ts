import { describe, expect, it } from 'vitest';

import { buildSnapshot, unlockedIdsForSnapshot, type SnapshotInputs } from './achievements';
import type {
  ActivityRecord,
  AttemptEventRecord,
  CheckpointResultRecord,
  ExamResultRecord,
  FlashcardReviewRecord,
} from './progress-db';

const baseInputs: SnapshotInputs = {
  progress: [],
  attemptEvents: [],
  activity: [],
  checkpointResults: [],
  examResults: [],
  reExamSchedule: [],
  flashcardReviews: [],
  lifetimeReviews: 0,
  interviewStudiedCount: 0,
  interviewTotalCount: 0,
  currentStreak: 0,
  topics: [],
  noteCount: 0,
  bookmarkCount: 0,
  highlightCount: 0,
  userCardCount: 0,
};

const attemptEvent = (overrides: Partial<AttemptEventRecord>): AttemptEventRecord => ({
  topicSlug: 't',
  exerciseId: 'e',
  concept: '',
  difficulty: '',
  status: 'pass',
  at: '2026-01-05T00:00:00.000Z',
  ...overrides,
});

const checkpoint = (overrides: Partial<CheckpointResultRecord>): CheckpointResultRecord => ({
  topicSlug: 't',
  conceptId: 'c',
  status: 'pass',
  at: '2026-01-05T00:00:00.000Z',
  ...overrides,
});

const activity = (overrides: Partial<ActivityRecord>): ActivityRecord => ({
  day: '2026-01-05',
  exercisesAttempted: 0,
  exercisesPassed: 0,
  ...overrides,
});

describe('buildSnapshot: accuracy and hints', () => {
  it('computes overall accuracy and hint-free pass count from attempt events', () => {
    const snapshot = buildSnapshot({
      ...baseInputs,
      attemptEvents: [
        attemptEvent({ exerciseId: 'e1', status: 'pass', hintsRevealed: 0 }),
        attemptEvent({ exerciseId: 'e2', status: 'fail' }),
        attemptEvent({ exerciseId: 'e3', status: 'pass', hintsRevealed: 1 }),
      ],
    });

    expect(snapshot.totalAttempts).toBe(3);
    expect(snapshot.overallAccuracy).toBeCloseTo(2 / 3);
    expect(snapshot.hintFreePassCount).toBe(1);
  });

  it('reports zero accuracy without dividing by zero when there are no attempts', () => {
    const snapshot = buildSnapshot(baseInputs);
    expect(snapshot.totalAttempts).toBe(0);
    expect(snapshot.overallAccuracy).toBe(0);
  });
});

describe('buildSnapshot: checkpoint streak', () => {
  it('finds the longest consecutive pass streak regardless of input order', () => {
    const snapshot = buildSnapshot({
      ...baseInputs,
      checkpointResults: [
        checkpoint({ status: 'pass', at: '2026-01-03T00:00:00.000Z' }),
        checkpoint({ status: 'pass', at: '2026-01-01T00:00:00.000Z' }),
        checkpoint({ status: 'fail', at: '2026-01-02T00:00:00.000Z' }),
        checkpoint({ status: 'pass', at: '2026-01-04T00:00:00.000Z' }),
        checkpoint({ status: 'pass', at: '2026-01-05T00:00:00.000Z' }),
      ],
    });

    expect(snapshot.longestCheckpointPassStreak).toBe(3);
  });
});

describe('buildSnapshot: weekend and perfect-week activity', () => {
  it('flags a weekend as active only when both Saturday and Sunday have activity', () => {
    const saturdayOnly = buildSnapshot({
      ...baseInputs,
      activity: [activity({ day: '2026-01-10', exercisesAttempted: 1 })],
    });
    expect(saturdayOnly.hasWeekendActive).toBe(false);

    const bothDays = buildSnapshot({
      ...baseInputs,
      activity: [
        activity({ day: '2026-01-10', exercisesAttempted: 1 }),
        activity({ day: '2026-01-11', exercisesAttempted: 1 }),
      ],
    });
    expect(bothDays.hasWeekendActive).toBe(true);
    expect(bothDays.hasPerfectWeek).toBe(false);
  });

  it('flags a perfect week only once all 7 days of the Mon-Sun week are active', () => {
    const days = [
      '2026-01-05',
      '2026-01-06',
      '2026-01-07',
      '2026-01-08',
      '2026-01-09',
      '2026-01-10',
    ];
    const almostFull = buildSnapshot({
      ...baseInputs,
      activity: days.map((day) => activity({ day, exercisesAttempted: 1 })),
    });
    expect(almostFull.hasPerfectWeek).toBe(false);

    const fullWeek = buildSnapshot({
      ...baseInputs,
      activity: [...days, '2026-01-11'].map((day) => activity({ day, exercisesAttempted: 1 })),
    });
    expect(fullWeek.hasPerfectWeek).toBe(true);
  });
});

describe('buildSnapshot: calibration', () => {
  it('derives a calibration score from confident, correct attempts', () => {
    const events = Array.from({ length: 30 }, (_, i) =>
      attemptEvent({ exerciseId: `e${i}`, status: 'pass', confidence: 'sure' }),
    );
    const snapshot = buildSnapshot({ ...baseInputs, attemptEvents: events });

    expect(snapshot.calibrationSampleCount).toBe(30);
    expect(snapshot.calibrationScore).toBeGreaterThan(0.85);
  });

  it('ignores attempts without a recorded confidence level', () => {
    const snapshot = buildSnapshot({
      ...baseInputs,
      attemptEvents: [attemptEvent({ status: 'pass' })],
    });
    expect(snapshot.calibrationSampleCount).toBe(0);
  });
});

describe('buildSnapshot: retention', () => {
  const reviewedCard = (topicSlug: string, cardId: string): FlashcardReviewRecord => ({
    id: `${topicSlug}:${cardId}`,
    topicSlug,
    cardId,
    due: new Date().toISOString(),
    stability: 100,
    difficulty: 5,
    elapsedDays: 0,
    scheduledDays: 30,
    reps: 5,
    lapses: 0,
    state: 2,
    lastReviewAt: new Date().toISOString(),
  });

  it('requires at least two well-retained topics before flagging high retention', () => {
    const oneTopic = buildSnapshot({
      ...baseInputs,
      flashcardReviews: Array.from({ length: 20 }, (_, i) => reviewedCard('a', `c${i}`)),
    });
    expect(oneTopic.hasHighRetention).toBe(false);

    const twoTopics = buildSnapshot({
      ...baseInputs,
      flashcardReviews: [
        ...Array.from({ length: 20 }, (_, i) => reviewedCard('a', `c${i}`)),
        ...Array.from({ length: 20 }, (_, i) => reviewedCard('b', `c${i}`)),
      ],
    });
    expect(twoTopics.hasHighRetention).toBe(true);
  });
});

describe('buildSnapshot: "all" gates never unlock vacuously', () => {
  it('keeps topics-mastered-all and interview-all locked when the totals are zero', () => {
    const snapshot = buildSnapshot({ ...baseInputs, interviewTotalCount: 0, topics: [] });
    expect(snapshot.topicsTotalCount).toBe(0);
    expect(unlockedIdsForSnapshot(snapshot)).not.toContain('topics-mastered-all');
    expect(unlockedIdsForSnapshot(snapshot)).not.toContain('interview-all');
  });

  it('unlocks topics-mastered-all and interview-all once every item is complete', () => {
    const snapshot = buildSnapshot({
      ...baseInputs,
      topics: [{ totalConcepts: 3, readConcepts: 3 }],
      interviewStudiedCount: 5,
      interviewTotalCount: 5,
    });
    expect(unlockedIdsForSnapshot(snapshot)).toContain('topics-mastered-all');
    expect(unlockedIdsForSnapshot(snapshot)).toContain('interview-all');
  });
});

describe('buildSnapshot: exams and re-exams', () => {
  const exam = (overrides: Partial<ExamResultRecord>): ExamResultRecord => ({
    id: 'exam-1',
    scope: 'interview',
    filters: {},
    total: 10,
    correct: 10,
    byType: {},
    byDifficulty: {},
    durationMs: 1000,
    startedAt: '2026-01-05T00:00:00.000Z',
    finishedAt: '2026-01-05T00:10:00.000Z',
    ...overrides,
  });

  it('only counts an exam as perfect when every question was answered correctly', () => {
    const imperfect = buildSnapshot({
      ...baseInputs,
      examResults: [exam({ correct: 9 })],
    });
    expect(imperfect.examCount).toBe(1);
    expect(imperfect.hasPerfectExam).toBe(false);

    const perfect = buildSnapshot({
      ...baseInputs,
      examResults: [exam({ correct: 10 })],
    });
    expect(perfect.hasPerfectExam).toBe(true);
  });

  it('flags graduation once any concept has graduated the re-exam ladder', () => {
    const snapshot = buildSnapshot({
      ...baseInputs,
      reExamSchedule: [
        {
          id: 't:c',
          topicSlug: 't',
          conceptId: 'c',
          due: '2026-01-05T00:00:00.000Z',
          stepIndex: 5,
          streak: 3,
          lastStatus: 'pass',
          graduated: true,
          updatedAt: '2026-01-05T00:00:00.000Z',
        },
      ],
    });
    expect(snapshot.hasGraduatedReExam).toBe(true);
  });
});
