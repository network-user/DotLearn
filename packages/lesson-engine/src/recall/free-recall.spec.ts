import { describe, expect, it } from 'vitest';

import type { ReExamState } from '../scheduling/re-exam';
import {
  freeRecallStatus,
  RECALL_PASS_THRESHOLD,
  scoreFreeRecall,
  shouldScheduleFreeRecallReExam,
  type FreeRecallItemOutcome,
} from './free-recall';

describe('scoreFreeRecall', () => {
  it('scores an empty outcome list as all zero', () => {
    expect(scoreFreeRecall([])).toEqual({ recalled: 0, total: 0, ratio: 0 });
  });

  it('scores a mixed outcome list', () => {
    const outcomes: FreeRecallItemOutcome[] = ['recalled', 'missed', 'recalled'];
    const score = scoreFreeRecall(outcomes);
    expect(score.recalled).toBe(2);
    expect(score.total).toBe(3);
    expect(score.ratio).toBeCloseTo(0.667, 3);
  });

  it('scores a fully recalled list with ratio 1', () => {
    const outcomes: FreeRecallItemOutcome[] = ['recalled', 'recalled'];
    expect(scoreFreeRecall(outcomes)).toEqual({ recalled: 2, total: 2, ratio: 1 });
  });
});

describe('freeRecallStatus', () => {
  it('passes exactly at the 0.6 ratio boundary', () => {
    expect(freeRecallStatus({ recalled: 3, total: 5, ratio: 0.6 })).toBe('pass');
  });

  it('fails just below the 0.6 ratio boundary', () => {
    expect(freeRecallStatus({ recalled: 59, total: 100, ratio: 0.59 })).toBe('fail');
  });

  it('passes a ratio of 1', () => {
    expect(freeRecallStatus({ recalled: 4, total: 4, ratio: 1 })).toBe('pass');
  });

  it('passes when there is nothing to recall', () => {
    expect(freeRecallStatus({ recalled: 0, total: 0, ratio: 0 })).toBe('pass');
  });

  it('supports a custom threshold', () => {
    expect(freeRecallStatus({ recalled: 7, total: 10, ratio: 0.7 }, 0.8)).toBe('fail');
    expect(freeRecallStatus({ recalled: 8, total: 10, ratio: 0.8 }, 0.8)).toBe('pass');
  });

  it('uses RECALL_PASS_THRESHOLD as the default threshold', () => {
    expect(RECALL_PASS_THRESHOLD).toBe(0.6);
  });
});

describe('shouldScheduleFreeRecallReExam', () => {
  it.each<[ReExamState | undefined, boolean, boolean]>([
    [undefined, false, false],
    [undefined, true, true],
    [{ stepIndex: 1, streak: 2, graduated: false }, false, true],
    [{ stepIndex: 1, streak: 2, graduated: false }, true, true],
  ])('prev=%o passed=%s -> %s', (prev, passed, expected) => {
    expect(shouldScheduleFreeRecallReExam(prev, passed)).toBe(expected);
  });
});
