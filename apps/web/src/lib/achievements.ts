import { useEffect, useMemo, useRef } from 'react';

import { summarizeCalibration, type CalibrationSample } from '@dotlearn/lesson-engine';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Award,
  BadgeCheck,
  BookMarked,
  BookOpenCheck,
  Brain,
  CalendarDays,
  CalendarCheck2,
  CalendarHeart,
  CalendarRange,
  CheckCheck,
  ClipboardCheck,
  Crosshair,
  Crown,
  FileCheck2,
  Flame,
  Gauge,
  GraduationCap,
  HelpCircle,
  Highlighter,
  Hourglass,
  Infinity as InfinityIcon,
  Layers3,
  LayoutTemplate,
  LightbulbOff,
  Medal,
  NotebookPen,
  PartyPopper,
  Repeat,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  Waves,
  Zap,
  type LucideIcon,
} from 'lucide-react';

import { isActiveDay } from './use-progress';
import { recallByTopicFromRecords } from './retention';
import {
  db,
  localDayKey,
  persistAchievementUnlocks,
  type ActivityRecord,
  type AttemptEventRecord,
  type CheckpointResultRecord,
  type ExamResultRecord,
  type FlashcardReviewRecord,
  type ProgressRecord,
  type ReExamScheduleRecord,
} from './progress-db';

export type AchievementId =
  | 'first-exercise'
  | 'first-topic-mastered'
  | 'streak-7'
  | 'streak-30'
  | 'streak-100'
  | 'reviews-100'
  | 'reviews-500'
  | 'reviews-1000'
  | 'topic-fully-read'
  | 'three-topics-one-day'
  | 'flawless-day'
  | 'first-interview'
  | 'interview-50'
  | 'exercises-50'
  | 'exercises-250'
  | 'streak-14'
  | 'streak-365'
  | 'reviews-2500'
  | 'topics-mastered-3'
  | 'topics-mastered-all'
  | 'five-topics-one-day'
  | 'interview-10'
  | 'interview-all'
  | 'sharp-shooter'
  | 'well-calibrated'
  | 'hint-free-25'
  | 'checkpoint-streak-20'
  | 're-exam-graduate'
  | 'first-exam'
  | 'exam-ace'
  | 'note-taker'
  | 'bookmarker'
  | 'highlighter'
  | 'card-creator'
  | 'weekend-warrior'
  | 'perfect-week'
  | 'deep-focus'
  | 'retention-master';

export type AchievementTier = 'bronze' | 'silver' | 'gold';

export interface AchievementDefinition {
  id: AchievementId;
  tier: AchievementTier;
  icon: LucideIcon;
  isUnlocked: (snapshot: AchievementSnapshot) => boolean;
}

export interface AchievementSnapshot {
  passedExercises: number;
  topicMasteredCount: number;
  currentStreak: number;
  lifetimeReviews: number;
  hasFullyReadTopic: boolean;
  maxDistinctTopicsInOneDay: number;
  hasFlawlessDay: boolean;
  interviewStudiedCount: number;
  topicsTotalCount: number;
  interviewTotalCount: number;
  overallAccuracy: number;
  totalAttempts: number;
  hintFreePassCount: number;
  longestCheckpointPassStreak: number;
  hasGraduatedReExam: boolean;
  examCount: number;
  hasPerfectExam: boolean;
  noteCount: number;
  bookmarkCount: number;
  highlightCount: number;
  userCardCount: number;
  hasWeekendActive: boolean;
  hasPerfectWeek: boolean;
  focusBlocksTotal: number;
  calibrationScore: number;
  calibrationSampleCount: number;
  hasHighRetention: boolean;
}

export interface AchievementView extends AchievementDefinition {
  unlocked: boolean;
  unlockedAt?: string;
}

const STREAK_7 = 7;
const STREAK_30 = 30;
const STREAK_100 = 100;
const REVIEWS_100 = 100;
const REVIEWS_500 = 500;
const REVIEWS_1000 = 1000;
const DISTINCT_TOPICS_ONE_DAY = 3;
const INTERVIEW_MILESTONE = 50;

const EXERCISES_50 = 50;
const EXERCISES_250 = 250;
const STREAK_14 = 14;
const STREAK_365 = 365;
const REVIEWS_2500 = 2500;
const TOPICS_MASTERED_3 = 3;
const FIVE_TOPICS_ONE_DAY = 5;
const INTERVIEW_10 = 10;
const SHARP_SHOOTER_MIN_ATTEMPTS = 100;
const SHARP_SHOOTER_ACCURACY = 0.95;
const WELL_CALIBRATED_MIN_SAMPLES = 30;
const WELL_CALIBRATED_SCORE = 0.85;
const HINT_FREE_25 = 25;
const CHECKPOINT_STREAK_20 = 20;
const EXAM_ACE_MIN_QUESTIONS = 10;
const NOTE_TAKER_MIN = 10;
const BOOKMARKER_MIN = 10;
const HIGHLIGHTER_MIN = 20;
const CARD_CREATOR_MIN = 10;
const DEEP_FOCUS_MIN = 20;
const RETENTION_TOPICS_MIN = 2;
const RETENTION_REVIEWED_MIN = 20;
const RETENTION_RECALL_MIN = 0.85;

export const ACHIEVEMENT_DEFINITIONS: readonly AchievementDefinition[] = [
  {
    id: 'first-exercise',
    tier: 'bronze',
    icon: Sparkles,
    isUnlocked: (s) => s.passedExercises >= 1,
  },
  {
    id: 'first-topic-mastered',
    tier: 'silver',
    icon: GraduationCap,
    isUnlocked: (s) => s.topicMasteredCount >= 1,
  },
  {
    id: 'streak-7',
    tier: 'bronze',
    icon: Flame,
    isUnlocked: (s) => s.currentStreak >= STREAK_7,
  },
  {
    id: 'streak-30',
    tier: 'silver',
    icon: Flame,
    isUnlocked: (s) => s.currentStreak >= STREAK_30,
  },
  {
    id: 'streak-100',
    tier: 'gold',
    icon: Flame,
    isUnlocked: (s) => s.currentStreak >= STREAK_100,
  },
  {
    id: 'reviews-100',
    tier: 'bronze',
    icon: Repeat,
    isUnlocked: (s) => s.lifetimeReviews >= REVIEWS_100,
  },
  {
    id: 'reviews-500',
    tier: 'silver',
    icon: Layers3,
    isUnlocked: (s) => s.lifetimeReviews >= REVIEWS_500,
  },
  {
    id: 'reviews-1000',
    tier: 'gold',
    icon: Medal,
    isUnlocked: (s) => s.lifetimeReviews >= REVIEWS_1000,
  },
  {
    id: 'topic-fully-read',
    tier: 'silver',
    icon: BookOpenCheck,
    isUnlocked: (s) => s.hasFullyReadTopic,
  },
  {
    id: 'three-topics-one-day',
    tier: 'silver',
    icon: CalendarRange,
    isUnlocked: (s) => s.maxDistinctTopicsInOneDay >= DISTINCT_TOPICS_ONE_DAY,
  },
  {
    id: 'flawless-day',
    tier: 'gold',
    icon: ShieldCheck,
    isUnlocked: (s) => s.hasFlawlessDay,
  },
  {
    id: 'first-interview',
    tier: 'bronze',
    icon: Brain,
    isUnlocked: (s) => s.interviewStudiedCount >= 1,
  },
  {
    id: 'interview-50',
    tier: 'gold',
    icon: Trophy,
    isUnlocked: (s) => s.interviewStudiedCount >= INTERVIEW_MILESTONE,
  },
  {
    id: 'exercises-50',
    tier: 'silver',
    icon: Zap,
    isUnlocked: (s) => s.passedExercises >= EXERCISES_50,
  },
  {
    id: 'exercises-250',
    tier: 'gold',
    icon: Rocket,
    isUnlocked: (s) => s.passedExercises >= EXERCISES_250,
  },
  {
    id: 'streak-14',
    tier: 'bronze',
    icon: Flame,
    isUnlocked: (s) => s.currentStreak >= STREAK_14,
  },
  {
    id: 'streak-365',
    tier: 'gold',
    icon: Star,
    isUnlocked: (s) => s.currentStreak >= STREAK_365,
  },
  {
    id: 'reviews-2500',
    tier: 'gold',
    icon: InfinityIcon,
    isUnlocked: (s) => s.lifetimeReviews >= REVIEWS_2500,
  },
  {
    id: 'topics-mastered-3',
    tier: 'silver',
    icon: CheckCheck,
    isUnlocked: (s) => s.topicMasteredCount >= TOPICS_MASTERED_3,
  },
  {
    id: 'topics-mastered-all',
    tier: 'gold',
    icon: Crown,
    isUnlocked: (s) => s.topicsTotalCount > 0 && s.topicMasteredCount >= s.topicsTotalCount,
  },
  {
    id: 'five-topics-one-day',
    tier: 'gold',
    icon: CalendarDays,
    isUnlocked: (s) => s.maxDistinctTopicsInOneDay >= FIVE_TOPICS_ONE_DAY,
  },
  {
    id: 'interview-10',
    tier: 'bronze',
    icon: HelpCircle,
    isUnlocked: (s) => s.interviewStudiedCount >= INTERVIEW_10,
  },
  {
    id: 'interview-all',
    tier: 'gold',
    icon: BadgeCheck,
    isUnlocked: (s) =>
      s.interviewTotalCount > 0 && s.interviewStudiedCount >= s.interviewTotalCount,
  },
  {
    id: 'sharp-shooter',
    tier: 'gold',
    icon: Crosshair,
    isUnlocked: (s) =>
      s.totalAttempts >= SHARP_SHOOTER_MIN_ATTEMPTS && s.overallAccuracy >= SHARP_SHOOTER_ACCURACY,
  },
  {
    id: 'well-calibrated',
    tier: 'silver',
    icon: Gauge,
    isUnlocked: (s) =>
      s.calibrationSampleCount >= WELL_CALIBRATED_MIN_SAMPLES &&
      s.calibrationScore >= WELL_CALIBRATED_SCORE,
  },
  {
    id: 'hint-free-25',
    tier: 'silver',
    icon: LightbulbOff,
    isUnlocked: (s) => s.hintFreePassCount >= HINT_FREE_25,
  },
  {
    id: 'checkpoint-streak-20',
    tier: 'silver',
    icon: ClipboardCheck,
    isUnlocked: (s) => s.longestCheckpointPassStreak >= CHECKPOINT_STREAK_20,
  },
  {
    id: 're-exam-graduate',
    tier: 'gold',
    icon: GraduationCap,
    isUnlocked: (s) => s.hasGraduatedReExam,
  },
  {
    id: 'first-exam',
    tier: 'bronze',
    icon: FileCheck2,
    isUnlocked: (s) => s.examCount >= 1,
  },
  {
    id: 'exam-ace',
    tier: 'gold',
    icon: PartyPopper,
    isUnlocked: (s) => s.hasPerfectExam,
  },
  {
    id: 'note-taker',
    tier: 'bronze',
    icon: NotebookPen,
    isUnlocked: (s) => s.noteCount >= NOTE_TAKER_MIN,
  },
  {
    id: 'bookmarker',
    tier: 'bronze',
    icon: BookMarked,
    isUnlocked: (s) => s.bookmarkCount >= BOOKMARKER_MIN,
  },
  {
    id: 'highlighter',
    tier: 'bronze',
    icon: Highlighter,
    isUnlocked: (s) => s.highlightCount >= HIGHLIGHTER_MIN,
  },
  {
    id: 'card-creator',
    tier: 'silver',
    icon: LayoutTemplate,
    isUnlocked: (s) => s.userCardCount >= CARD_CREATOR_MIN,
  },
  {
    id: 'weekend-warrior',
    tier: 'bronze',
    icon: CalendarHeart,
    isUnlocked: (s) => s.hasWeekendActive,
  },
  {
    id: 'perfect-week',
    tier: 'gold',
    icon: CalendarCheck2,
    isUnlocked: (s) => s.hasPerfectWeek,
  },
  {
    id: 'deep-focus',
    tier: 'bronze',
    icon: Hourglass,
    isUnlocked: (s) => s.focusBlocksTotal >= DEEP_FOCUS_MIN,
  },
  {
    id: 'retention-master',
    tier: 'gold',
    icon: Waves,
    isUnlocked: (s) => s.hasHighRetention,
  },
];

export const ACHIEVEMENT_FALLBACK_ICON: LucideIcon = Award;

export const unlockedIdsForSnapshot = (snapshot: AchievementSnapshot): AchievementId[] =>
  ACHIEVEMENT_DEFINITIONS.filter((definition) => definition.isUnlocked(snapshot)).map(
    (definition) => definition.id,
  );

export interface TopicReadInput {
  totalConcepts: number;
  readConcepts: number;
}

export interface SnapshotInputs {
  progress: readonly ProgressRecord[];
  attemptEvents: readonly AttemptEventRecord[];
  activity: readonly ActivityRecord[];
  checkpointResults: readonly CheckpointResultRecord[];
  examResults: readonly ExamResultRecord[];
  reExamSchedule: readonly ReExamScheduleRecord[];
  flashcardReviews: readonly FlashcardReviewRecord[];
  lifetimeReviews: number;
  interviewStudiedCount: number;
  interviewTotalCount: number;
  currentStreak: number;
  topics: readonly TopicReadInput[];
  noteCount: number;
  bookmarkCount: number;
  highlightCount: number;
  userCardCount: number;
}

const dayKeyOf = (iso: string): string => localDayKey(new Date(iso));

export const buildSnapshot = (inputs: SnapshotInputs): AchievementSnapshot => {
  const passedExercises = inputs.progress.filter((record) => record.status === 'pass').length;

  const topicMasteredCount = inputs.topics.filter(
    (topic) => topic.totalConcepts > 0 && topic.readConcepts >= topic.totalConcepts,
  ).length;

  const hasFullyReadTopic = topicMasteredCount > 0;

  const topicsByDay = new Map<string, Set<string>>();
  const passByDay = new Map<string, number>();
  const failByDay = new Map<string, number>();

  for (const event of inputs.attemptEvents) {
    if (!event.at) continue;
    const day = dayKeyOf(event.at);
    const topics = topicsByDay.get(day) ?? new Set<string>();
    topics.add(event.topicSlug);
    topicsByDay.set(day, topics);
    if (event.status === 'pass') {
      passByDay.set(day, (passByDay.get(day) ?? 0) + 1);
    } else {
      failByDay.set(day, (failByDay.get(day) ?? 0) + 1);
    }
  }

  let maxDistinctTopicsInOneDay = 0;
  for (const topics of topicsByDay.values()) {
    if (topics.size > maxDistinctTopicsInOneDay) {
      maxDistinctTopicsInOneDay = topics.size;
    }
  }

  let hasFlawlessDay = false;
  for (const [day, passes] of passByDay) {
    if (passes > 0 && (failByDay.get(day) ?? 0) === 0) {
      hasFlawlessDay = true;
      break;
    }
  }

  const totalAttempts = inputs.attemptEvents.length;
  const passedAttempts = inputs.attemptEvents.filter((event) => event.status === 'pass').length;
  const overallAccuracy = totalAttempts > 0 ? passedAttempts / totalAttempts : 0;
  const hintFreePassCount = inputs.attemptEvents.filter(
    (event) => event.status === 'pass' && (event.hintsRevealed ?? 0) === 0,
  ).length;

  const sortedCheckpoints = [...inputs.checkpointResults].sort((a, b) => a.at.localeCompare(b.at));
  let longestCheckpointPassStreak = 0;
  let checkpointRun = 0;
  for (const result of sortedCheckpoints) {
    if (result.status === 'pass') {
      checkpointRun += 1;
      if (checkpointRun > longestCheckpointPassStreak) {
        longestCheckpointPassStreak = checkpointRun;
      }
    } else {
      checkpointRun = 0;
    }
  }

  const hasGraduatedReExam = inputs.reExamSchedule.some((record) => record.graduated);

  const examCount = inputs.examResults.length;
  const hasPerfectExam = inputs.examResults.some(
    (result) => result.total >= EXAM_ACE_MIN_QUESTIONS && result.correct === result.total,
  );

  const focusBlocksTotal = inputs.activity.reduce(
    (sum, entry) => sum + (entry.focusBlocks ?? 0),
    0,
  );

  const activeDayKeys = new Set(inputs.activity.filter(isActiveDay).map((entry) => entry.day));
  const weekdaysByWeek = new Map<string, Set<number>>();
  for (const dayKey of activeDayKeys) {
    const date = new Date(`${dayKey}T00:00:00`);
    const dayOfWeek = date.getDay();
    const monday = new Date(date);
    monday.setDate(monday.getDate() - ((dayOfWeek + 6) % 7));
    const weekKey = localDayKey(monday);
    const weekdays = weekdaysByWeek.get(weekKey) ?? new Set<number>();
    weekdays.add(dayOfWeek);
    weekdaysByWeek.set(weekKey, weekdays);
  }
  let hasWeekendActive = false;
  let hasPerfectWeek = false;
  for (const weekdays of weekdaysByWeek.values()) {
    if (weekdays.has(0) && weekdays.has(6)) hasWeekendActive = true;
    if (weekdays.size >= 7) hasPerfectWeek = true;
  }

  const calibrationSamples: CalibrationSample[] = [];
  for (const event of inputs.attemptEvents) {
    if (!event.confidence) continue;
    calibrationSamples.push({
      confidence: event.confidence,
      correct: event.status === 'pass',
      topicSlug: event.topicSlug,
    });
  }
  for (const result of inputs.checkpointResults) {
    if (!result.confidence) continue;
    calibrationSamples.push({
      confidence: result.confidence,
      correct: result.status === 'pass',
      topicSlug: result.topicSlug,
    });
  }
  const calibration = summarizeCalibration(calibrationSamples);

  const recallByTopic = recallByTopicFromRecords(inputs.flashcardReviews);
  const strongRetentionTopics = [...recallByTopic.values()].filter(
    (topic) =>
      topic.reviewedCards >= RETENTION_REVIEWED_MIN && topic.recall >= RETENTION_RECALL_MIN,
  ).length;

  return {
    passedExercises,
    topicMasteredCount,
    currentStreak: inputs.currentStreak,
    lifetimeReviews: inputs.lifetimeReviews,
    hasFullyReadTopic,
    maxDistinctTopicsInOneDay,
    hasFlawlessDay,
    interviewStudiedCount: inputs.interviewStudiedCount,
    topicsTotalCount: inputs.topics.length,
    interviewTotalCount: inputs.interviewTotalCount,
    overallAccuracy,
    totalAttempts,
    hintFreePassCount,
    longestCheckpointPassStreak,
    hasGraduatedReExam,
    examCount,
    hasPerfectExam,
    noteCount: inputs.noteCount,
    bookmarkCount: inputs.bookmarkCount,
    highlightCount: inputs.highlightCount,
    userCardCount: inputs.userCardCount,
    hasWeekendActive,
    hasPerfectWeek,
    focusBlocksTotal,
    calibrationScore: calibration.calibrationScore,
    calibrationSampleCount: calibration.total,
    hasHighRetention: strongRetentionTopics >= RETENTION_TOPICS_MIN,
  };
};

export const reconcileUnlocks = (
  unlockedIds: readonly AchievementId[],
  existing: ReadonlyMap<string, string>,
  now: () => string = () => new Date().toISOString(),
): { records: { id: AchievementId; unlockedAt: string }[]; newlyUnlocked: AchievementId[] } => {
  const records: { id: AchievementId; unlockedAt: string }[] = [];
  const newlyUnlocked: AchievementId[] = [];
  const timestamp = now();
  for (const id of unlockedIds) {
    if (existing.has(id)) continue;
    records.push({ id, unlockedAt: timestamp });
    newlyUnlocked.push(id);
  }
  return { records, newlyUnlocked };
};

export interface AchievementsState {
  views: AchievementView[];
  unlockedCount: number;
  total: number;
  newlyUnlocked: AchievementId[];
}

const buildViews = (
  unlockedIds: ReadonlySet<AchievementId>,
  persisted: ReadonlyMap<string, string>,
): AchievementView[] =>
  ACHIEVEMENT_DEFINITIONS.map((definition) => {
    const unlockedAt = persisted.get(definition.id);
    return {
      ...definition,
      unlocked: unlockedAt !== undefined || unlockedIds.has(definition.id),
      ...(unlockedAt !== undefined ? { unlockedAt } : {}),
    };
  });

const EMPTY_STATE: AchievementsState = {
  views: ACHIEVEMENT_DEFINITIONS.map((definition) => ({ ...definition, unlocked: false })),
  unlockedCount: 0,
  total: ACHIEVEMENT_DEFINITIONS.length,
  newlyUnlocked: [],
};

export const useAchievements = (
  topics: readonly TopicReadInput[],
  currentStreak: number,
  interviewTotal: number,
  onUnlock?: (ids: AchievementId[]) => void,
): AchievementsState => {
  const progress = useLiveQuery(() => db.progress.toArray(), [], undefined);
  const attemptEvents = useLiveQuery(() => db.attemptEvents.toArray(), [], undefined);
  const activity = useLiveQuery(() => db.activity.toArray(), [], undefined);
  const interviewStudiedCount = useLiveQuery(() => db.interviewStudied.count(), [], undefined);
  const persistedRecords = useLiveQuery(() => db.achievements.toArray(), [], undefined);
  const checkpointResults = useLiveQuery(() => db.checkpointResults.toArray(), [], undefined);
  const examResults = useLiveQuery(() => db.examResults.toArray(), [], undefined);
  const reExamSchedule = useLiveQuery(() => db.reExamSchedule.toArray(), [], undefined);
  const flashcardReviews = useLiveQuery(() => db.flashcardReviews.toArray(), [], undefined);
  const noteCount = useLiveQuery(() => db.conceptNotes.count(), [], undefined);
  const bookmarkCount = useLiveQuery(() => db.bookmarks.count(), [], undefined);
  const highlightCount = useLiveQuery(() => db.highlights.count(), [], undefined);
  const userCardCount = useLiveQuery(() => db.userCards.count(), [], undefined);

  const onUnlockRef = useRef(onUnlock);
  onUnlockRef.current = onUnlock;

  const ready =
    progress !== undefined &&
    attemptEvents !== undefined &&
    activity !== undefined &&
    interviewStudiedCount !== undefined &&
    persistedRecords !== undefined &&
    checkpointResults !== undefined &&
    examResults !== undefined &&
    reExamSchedule !== undefined &&
    flashcardReviews !== undefined &&
    noteCount !== undefined &&
    bookmarkCount !== undefined &&
    highlightCount !== undefined &&
    userCardCount !== undefined;

  const lifetimeReviews = (activity ?? []).reduce(
    (sum, entry) => sum + (entry.cardsReviewed ?? 0),
    0,
  );

  const snapshot = useMemo(
    () =>
      ready
        ? buildSnapshot({
            progress: progress ?? [],
            attemptEvents: attemptEvents ?? [],
            activity: activity ?? [],
            checkpointResults: checkpointResults ?? [],
            examResults: examResults ?? [],
            reExamSchedule: reExamSchedule ?? [],
            flashcardReviews: flashcardReviews ?? [],
            lifetimeReviews,
            interviewStudiedCount: interviewStudiedCount ?? 0,
            interviewTotalCount: interviewTotal,
            currentStreak,
            topics,
            noteCount: noteCount ?? 0,
            bookmarkCount: bookmarkCount ?? 0,
            highlightCount: highlightCount ?? 0,
            userCardCount: userCardCount ?? 0,
          })
        : undefined,
    [
      ready,
      progress,
      attemptEvents,
      activity,
      checkpointResults,
      examResults,
      reExamSchedule,
      flashcardReviews,
      lifetimeReviews,
      interviewStudiedCount,
      interviewTotal,
      currentStreak,
      topics,
      noteCount,
      bookmarkCount,
      highlightCount,
      userCardCount,
    ],
  );

  const unlockedIds = useMemo(() => (snapshot ? unlockedIdsForSnapshot(snapshot) : []), [snapshot]);
  const persistedMap = useMemo(
    () => new Map((persistedRecords ?? []).map((record) => [record.id, record.unlockedAt])),
    [persistedRecords],
  );
  const views = useMemo(
    () => buildViews(new Set(unlockedIds), persistedMap),
    [unlockedIds, persistedMap],
  );

  const persistedKey = (persistedRecords ?? [])
    .map((record) => record.id)
    .sort()
    .join(',');
  const unlockedKey = [...unlockedIds].sort().join(',');

  const newlyUnlockedRef = useRef<AchievementId[]>([]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void (async () => {
      const { newlyUnlocked } = await persistAchievementUnlocks(unlockedIds);
      if (cancelled || newlyUnlocked.length === 0) return;
      newlyUnlockedRef.current = newlyUnlocked as AchievementId[];
      onUnlockRef.current?.(newlyUnlocked as AchievementId[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, unlockedKey, persistedKey]);

  if (!ready) return EMPTY_STATE;

  return {
    views,
    unlockedCount: views.filter((view) => view.unlocked).length,
    total: views.length,
    newlyUnlocked: newlyUnlockedRef.current,
  };
};
