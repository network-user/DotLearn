import { useEffect, useRef } from 'react';

import { useLiveQuery } from 'dexie-react-hooks';
import {
  Award,
  BookOpenCheck,
  Brain,
  CalendarRange,
  Flame,
  GraduationCap,
  Layers3,
  Medal,
  Repeat,
  ShieldCheck,
  Sparkles,
  Trophy,
  type LucideIcon,
} from 'lucide-react';

import {
  db,
  localDayKey,
  persistAchievementUnlocks,
  type AttemptEventRecord,
  type ProgressRecord,
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
  | 'interview-50';

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
];

export const ACHIEVEMENT_FALLBACK_ICON: LucideIcon = Award;

export const unlockedIdsForSnapshot = (
  snapshot: AchievementSnapshot,
): AchievementId[] =>
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
  lifetimeReviews: number;
  interviewStudiedCount: number;
  currentStreak: number;
  topics: readonly TopicReadInput[];
}

const dayKeyOf = (iso: string): string => localDayKey(new Date(iso));

export const buildSnapshot = (inputs: SnapshotInputs): AchievementSnapshot => {
  const passedExercises = inputs.progress.filter(
    (record) => record.status === 'pass',
  ).length;

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

  return {
    passedExercises,
    topicMasteredCount,
    currentStreak: inputs.currentStreak,
    lifetimeReviews: inputs.lifetimeReviews,
    hasFullyReadTopic,
    maxDistinctTopicsInOneDay,
    hasFlawlessDay,
    interviewStudiedCount: inputs.interviewStudiedCount,
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
  onUnlock?: (ids: AchievementId[]) => void,
): AchievementsState => {
  const progress = useLiveQuery(() => db.progress.toArray(), [], undefined);
  const attemptEvents = useLiveQuery(() => db.attemptEvents.toArray(), [], undefined);
  const activity = useLiveQuery(() => db.activity.toArray(), [], undefined);
  const interviewStudiedCount = useLiveQuery(() => db.interviewStudied.count(), [], undefined);
  const persistedRecords = useLiveQuery(() => db.achievements.toArray(), [], undefined);

  const onUnlockRef = useRef(onUnlock);
  onUnlockRef.current = onUnlock;

  const ready =
    progress !== undefined &&
    attemptEvents !== undefined &&
    activity !== undefined &&
    interviewStudiedCount !== undefined &&
    persistedRecords !== undefined;

  const lifetimeReviews = (activity ?? []).reduce(
    (sum, entry) => sum + (entry.cardsReviewed ?? 0),
    0,
  );

  const snapshot = ready
    ? buildSnapshot({
        progress: progress ?? [],
        attemptEvents: attemptEvents ?? [],
        lifetimeReviews,
        interviewStudiedCount: interviewStudiedCount ?? 0,
        currentStreak,
        topics,
      })
    : undefined;

  const unlockedIds = snapshot ? unlockedIdsForSnapshot(snapshot) : [];
  const persistedMap = new Map((persistedRecords ?? []).map((record) => [record.id, record.unlockedAt]));

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

  const views = buildViews(new Set(unlockedIds), persistedMap);
  return {
    views,
    unlockedCount: views.filter((view) => view.unlocked).length,
    total: views.length,
    newlyUnlocked: newlyUnlockedRef.current,
  };
};
