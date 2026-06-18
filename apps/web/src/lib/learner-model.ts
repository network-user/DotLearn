export interface ExerciseAttemptInput {
  exerciseId: string;
  conceptId: string;
  difficulty: number;
  status: 'pass' | 'fail';
  attempts: number;
  lastAttemptAt: string;
}

export interface ConceptStrength {
  conceptId: string;
  strength: number;
  attempted: number;
  passed: number;
  weightedRatio: number;
  recentFailPenalty: number;
  targetDifficulty: number;
}

const MIN_DIFFICULTY = 1;
const MAX_DIFFICULTY = 5;
const HALF_LIFE_DAYS = 30;
const RECENT_FAIL_WINDOW_DAYS = 7;
const RECENT_FAIL_PENALTY_PER = 0.12;
const MAX_RECENT_FAIL_PENALTY = 0.45;
const DAY_MS = 86_400_000;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export const clampDifficulty = (value: number): number =>
  Math.max(MIN_DIFFICULTY, Math.min(MAX_DIFFICULTY, value));

const safeTime = (iso: string): number => {
  const time = new Date(iso).getTime();
  return Number.isFinite(time) ? time : 0;
};

const decayFactor = (ageDays: number): number =>
  ageDays <= 0 ? 1 : Math.pow(0.5, ageDays / HALF_LIFE_DAYS);

export const computeConceptStrength = (
  attempts: readonly ExerciseAttemptInput[],
  now = Date.now(),
): ConceptStrength | undefined => {
  if (attempts.length === 0) return undefined;
  const conceptId = attempts[0]?.conceptId ?? '';

  let weightSum = 0;
  let passWeightSum = 0;
  let passed = 0;
  let recentFails = 0;

  for (const attempt of attempts) {
    const difficulty = clampDifficulty(attempt.difficulty);
    const ageDays = Math.max(0, (now - safeTime(attempt.lastAttemptAt)) / DAY_MS);
    const decay = decayFactor(ageDays);
    const weight = difficulty * decay;
    weightSum += weight;
    if (attempt.status === 'pass') {
      passWeightSum += weight;
      passed += 1;
    } else {
      if (ageDays <= RECENT_FAIL_WINDOW_DAYS) recentFails += 1;
    }
  }

  const weightedRatio = weightSum === 0 ? 0 : clamp01(passWeightSum / weightSum);
  const recentFailPenalty = Math.min(
    MAX_RECENT_FAIL_PENALTY,
    recentFails * RECENT_FAIL_PENALTY_PER,
  );
  const strength = clamp01(weightedRatio - recentFailPenalty);

  return {
    conceptId,
    strength,
    attempted: attempts.length,
    passed,
    weightedRatio,
    recentFailPenalty,
    targetDifficulty: targetDifficultyFromStrength(strength),
  };
};

export const targetDifficultyFromStrength = (strength: number): number => {
  const scaled = MIN_DIFFICULTY + clamp01(strength) * (MAX_DIFFICULTY - MIN_DIFFICULTY);
  return clampDifficulty(Math.round(scaled));
};

export const computeConceptStrengths = (
  attempts: readonly ExerciseAttemptInput[],
  now = Date.now(),
): Map<string, ConceptStrength> => {
  const byConcept = new Map<string, ExerciseAttemptInput[]>();
  for (const attempt of attempts) {
    const bucket = byConcept.get(attempt.conceptId) ?? [];
    bucket.push(attempt);
    byConcept.set(attempt.conceptId, bucket);
  }
  const result = new Map<string, ConceptStrength>();
  for (const [conceptId, bucket] of byConcept) {
    const strength = computeConceptStrength(bucket, now);
    if (strength) result.set(conceptId, strength);
  }
  return result;
};

export interface AdaptiveDifficultyInput {
  recentResults: readonly ('pass' | 'fail')[];
  baseDifficulty: number;
  cleanRunForStepUp?: number;
}

export const nextTargetDifficulty = (input: AdaptiveDifficultyInput): number => {
  const cleanRun = input.cleanRunForStepUp ?? 2;
  let difficulty = clampDifficulty(input.baseDifficulty);
  let streak = 0;
  for (const result of input.recentResults) {
    if (result === 'fail') {
      difficulty = clampDifficulty(difficulty - 1);
      streak = 0;
      continue;
    }
    streak += 1;
    if (streak >= cleanRun) {
      difficulty = clampDifficulty(difficulty + 1);
      streak = 0;
    }
  }
  return difficulty;
};

export interface Difficultied {
  difficulty: number;
}

export const reorderByTargetDifficulty = <T extends Difficultied>(
  items: readonly T[],
  targetDifficulty: number,
): T[] => {
  const target = clampDifficulty(targetDifficulty);
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const distanceA = Math.abs(clampDifficulty(a.item.difficulty) - target);
      const distanceB = Math.abs(clampDifficulty(b.item.difficulty) - target);
      if (distanceA !== distanceB) return distanceA - distanceB;
      if (a.item.difficulty !== b.item.difficulty) return a.item.difficulty - b.item.difficulty;
      return a.index - b.index;
    })
    .map((entry) => entry.item);
};

export interface WeakConcept {
  topicSlug: string;
  conceptId: string;
  strength: number;
  attempted: number;
}

export interface WeakConceptInput {
  topicSlug: string;
  attempts: readonly ExerciseAttemptInput[];
}

export const weakestConcepts = (
  inputs: readonly WeakConceptInput[],
  limit = 5,
  now = Date.now(),
): WeakConcept[] => {
  const weak: WeakConcept[] = [];
  for (const input of inputs) {
    const strengths = computeConceptStrengths(input.attempts, now);
    for (const strength of strengths.values()) {
      if (strength.attempted === 0) continue;
      weak.push({
        topicSlug: input.topicSlug,
        conceptId: strength.conceptId,
        strength: strength.strength,
        attempted: strength.attempted,
      });
    }
  }
  return weak
    .sort((a, b) => {
      if (a.strength !== b.strength) return a.strength - b.strength;
      return b.attempted - a.attempted;
    })
    .slice(0, Math.max(0, limit));
};
