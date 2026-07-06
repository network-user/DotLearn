import type { ReExamState } from '../scheduling/re-exam';

export const RECALL_PASS_THRESHOLD = 0.6;

export type FreeRecallItemOutcome = 'recalled' | 'missed';

export interface FreeRecallScore {
  recalled: number;
  total: number;
  ratio: number; // recalled/total; при total === 0 -> 0
}

export function scoreFreeRecall(outcomes: readonly FreeRecallItemOutcome[]): FreeRecallScore {
  const total = outcomes.length;
  const recalled = outcomes.filter((outcome) => outcome === 'recalled').length;
  return {
    recalled,
    total,
    ratio: total === 0 ? 0 : recalled / total,
  };
}

export function freeRecallStatus(
  score: FreeRecallScore,
  threshold: number = RECALL_PASS_THRESHOLD,
): 'pass' | 'fail' {
  if (score.total === 0) return 'pass';
  return score.ratio >= threshold ? 'pass' : 'fail';
}

// Pass always moves the re-exam ladder; a fail only moves it if a schedule already exists. A
// first failed recall right after reading should not spin up re-exams on its own.
export function shouldScheduleFreeRecallReExam(
  prev: ReExamState | undefined,
  passed: boolean,
): boolean {
  return passed || prev !== undefined;
}
