import { useLiveQuery } from 'dexie-react-hooks';

import {
  db,
  type ActivityRecord,
  type AttemptEventRecord,
  type ProgressRecord,
} from './progress-db';

export const XP_EXERCISE_FIRST_PASS = 10;
export const XP_CARD_REVIEW = 4;
export const XP_CONCEPT_READ = 6;
export const XP_INTERVIEW_STUDIED = 8;
export const XP_PER_LEVEL = 50;

export interface XpInputs {
  progress: readonly ProgressRecord[];
  attemptEvents: readonly AttemptEventRecord[];
  activity: readonly ActivityRecord[];
  conceptsReadCount: number;
  interviewStudiedCount: number;
}

export interface XpBreakdown {
  exercises: number;
  reviews: number;
  concepts: number;
  interview: number;
}

export interface XpState {
  total: number;
  level: number;
  breakdown: XpBreakdown;
  levelFloor: number;
  nextLevelAt: number;
  intoLevel: number;
  levelSpan: number;
  ratioToNext: number;
}

const difficultyMultiplier = (difficulty: string | undefined): number => {
  const parsed = Number.parseInt(difficulty ?? '', 10);
  if (!Number.isFinite(parsed) || parsed <= 1) return 1;
  return 1 + (Math.min(5, parsed) - 1) * 0.1;
};

const xpForLevel = (level: number): number => level * level * XP_PER_LEVEL;

export const levelForXp = (total: number): number =>
  total <= 0 ? 0 : Math.floor(Math.sqrt(total / XP_PER_LEVEL));

export const computeXp = (inputs: XpInputs): XpState => {
  const earliestPassAt = new Map<string, string>();
  const earliestPassDifficulty = new Map<string, string>();
  for (const event of inputs.attemptEvents) {
    if (event.status !== 'pass' || !event.at) continue;
    const key = `${event.topicSlug}:${event.exerciseId}`;
    const known = earliestPassAt.get(key);
    if (known === undefined || event.at < known) {
      earliestPassAt.set(key, event.at);
      earliestPassDifficulty.set(key, event.difficulty);
    }
  }

  let exercises = 0;
  for (const record of inputs.progress) {
    if (record.status !== 'pass') continue;
    const difficulty = earliestPassDifficulty.get(record.id);
    exercises += XP_EXERCISE_FIRST_PASS * difficultyMultiplier(difficulty);
  }
  exercises = Math.round(exercises);

  const cardReviews = inputs.activity.reduce((sum, entry) => sum + (entry.cardsReviewed ?? 0), 0);
  const reviews = cardReviews * XP_CARD_REVIEW;
  const concepts = inputs.conceptsReadCount * XP_CONCEPT_READ;
  const interview = inputs.interviewStudiedCount * XP_INTERVIEW_STUDIED;

  const total = exercises + reviews + concepts + interview;
  const level = levelForXp(total);
  const levelFloor = xpForLevel(level);
  const nextLevelAt = xpForLevel(level + 1);
  const levelSpan = nextLevelAt - levelFloor;
  const intoLevel = total - levelFloor;
  const ratioToNext = levelSpan > 0 ? Math.min(1, intoLevel / levelSpan) : 0;

  return {
    total,
    level,
    breakdown: { exercises, reviews, concepts, interview },
    levelFloor,
    nextLevelAt,
    intoLevel,
    levelSpan,
    ratioToNext,
  };
};

const EMPTY_XP: XpState = {
  total: 0,
  level: 0,
  breakdown: { exercises: 0, reviews: 0, concepts: 0, interview: 0 },
  levelFloor: 0,
  nextLevelAt: xpForLevel(1),
  intoLevel: 0,
  levelSpan: xpForLevel(1),
  ratioToNext: 0,
};

export const useXp = (): XpState | undefined => {
  const progress = useLiveQuery(() => db.progress.toArray(), [], undefined);
  const attemptEvents = useLiveQuery(() => db.attemptEvents.toArray(), [], undefined);
  const activity = useLiveQuery(() => db.activity.toArray(), [], undefined);
  const conceptsReadCount = useLiveQuery(() => db.conceptRead.count(), [], undefined);
  const interviewStudiedCount = useLiveQuery(() => db.interviewStudied.count(), [], undefined);

  if (
    progress === undefined ||
    attemptEvents === undefined ||
    activity === undefined ||
    conceptsReadCount === undefined ||
    interviewStudiedCount === undefined
  ) {
    return undefined;
  }

  if (
    progress.length === 0 &&
    activity.length === 0 &&
    conceptsReadCount === 0 &&
    interviewStudiedCount === 0
  ) {
    return EMPTY_XP;
  }

  return computeXp({
    progress,
    attemptEvents,
    activity,
    conceptsReadCount,
    interviewStudiedCount,
  });
};
