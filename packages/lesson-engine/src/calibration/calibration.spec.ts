import { describe, expect, it } from 'vitest';

import {
  calibrationByTopic,
  calibrationPriority,
  classifyCalibration,
  NOMINAL_CONFIDENCE,
  summarizeCalibration,
  type CalibrationSample,
} from './calibration';

const mixedSamples: CalibrationSample[] = [
  { confidence: 'sure', correct: true },
  { confidence: 'sure', correct: true },
  { confidence: 'sure', correct: true },
  { confidence: 'sure', correct: false },
  { confidence: 'unsure', correct: true },
  { confidence: 'unsure', correct: true },
  { confidence: 'unsure', correct: false },
  { confidence: 'unsure', correct: false },
  { confidence: 'guess', correct: true },
  { confidence: 'guess', correct: false },
  { confidence: 'guess', correct: false },
  { confidence: 'guess', correct: false },
];

describe('summarizeCalibration', () => {
  it('computes per-bucket counts, accuracy and gap', () => {
    const summary = summarizeCalibration(mixedSamples);

    expect(summary.total).toBe(12);
    expect(summary.buckets.map((bucket) => bucket.confidence)).toEqual(['sure', 'unsure', 'guess']);

    const sure = summary.buckets[0]!;
    expect(sure.count).toBe(4);
    expect(sure.correct).toBe(3);
    expect(sure.accuracy).toBeCloseTo(0.75, 10);
    expect(sure.expectedAccuracy).toBe(NOMINAL_CONFIDENCE.sure);
    expect(sure.gap).toBeCloseTo(0.75 - 0.9, 10);

    const unsure = summary.buckets[1]!;
    expect(unsure.count).toBe(4);
    expect(unsure.correct).toBe(2);
    expect(unsure.accuracy).toBeCloseTo(0.5, 10);
    expect(unsure.gap).toBeCloseTo(0.5 - 0.55, 10);

    const guess = summary.buckets[2]!;
    expect(guess.count).toBe(4);
    expect(guess.correct).toBe(1);
    expect(guess.accuracy).toBeCloseTo(0.25, 10);
    expect(guess.gap).toBeCloseTo(0.25 - 0.3, 10);
  });

  it('reports overconfidence as the share of sure answers that were wrong', () => {
    const summary = summarizeCalibration(mixedSamples);
    expect(summary.overconfidenceRate).toBeCloseTo(0.25, 10); // 1 of 4 sure answers was wrong
  });

  it('is not overconfident when there are no sure answers', () => {
    const summary = summarizeCalibration([{ confidence: 'guess', correct: false }]);
    expect(summary.overconfidenceRate).toBe(0);
  });

  it('reports underconfidence as the share of guess+unsure answers that were correct', () => {
    const summary = summarizeCalibration(mixedSamples);
    expect(summary.underconfidenceRate).toBeCloseTo(3 / 8, 10); // 1 guess + 2 unsure correct out of 8
  });

  it('is not underconfident when there are no guess or unsure answers', () => {
    const summary = summarizeCalibration([{ confidence: 'sure', correct: true }]);
    expect(summary.underconfidenceRate).toBe(0);
  });

  it('scores a low Brier (high calibration) when sure answers are always correct', () => {
    const summary = summarizeCalibration([
      { confidence: 'sure', correct: true },
      { confidence: 'sure', correct: true },
      { confidence: 'sure', correct: true },
    ]);
    expect(summary.brier).toBeCloseTo(0.01, 10);
    expect(summary.calibrationScore).toBeCloseTo(0.9, 10);
  });

  it('scores a high Brier (low calibration) when sure answers are always wrong', () => {
    const summary = summarizeCalibration([
      { confidence: 'sure', correct: false },
      { confidence: 'sure', correct: false },
    ]);
    expect(summary.brier).toBeCloseTo(0.81, 10);
    expect(summary.calibrationScore).toBeCloseTo(0.1, 10);
  });

  it('computes the combined Brier score and calibration score for a mixed sample', () => {
    const summary = summarizeCalibration(mixedSamples);
    expect(summary.brier).toBeCloseTo(0.2175, 10);
    expect(summary.calibrationScore).toBeCloseTo(0.5336310473455592, 10);
  });

  it('treats an empty sample set as perfectly calibrated', () => {
    const summary = summarizeCalibration([]);
    expect(summary.total).toBe(0);
    expect(summary.brier).toBe(0);
    expect(summary.calibrationScore).toBe(1);
    expect(summary.overconfidenceRate).toBe(0);
    expect(summary.underconfidenceRate).toBe(0);
    for (const bucket of summary.buckets) {
      expect(bucket.count).toBe(0);
      expect(bucket.accuracy).toBe(0);
    }
  });
});

describe('calibrationByTopic', () => {
  it('splits samples per topic and skips samples without a topicSlug', () => {
    const samples: CalibrationSample[] = [
      { confidence: 'sure', correct: true, topicSlug: 'hashing' },
      { confidence: 'sure', correct: false, topicSlug: 'hashing' },
      { confidence: 'guess', correct: true, topicSlug: 'git' },
      { confidence: 'sure', correct: true }, // no topicSlug, should be ignored
    ];

    const byTopic = calibrationByTopic(samples);

    expect([...byTopic.keys()].sort()).toEqual(['git', 'hashing']);
    expect(byTopic.get('hashing')!.total).toBe(2);
    expect(byTopic.get('git')!.total).toBe(1);
  });

  it('returns an empty map when no sample has a topicSlug', () => {
    const byTopic = calibrationByTopic([{ confidence: 'sure', correct: true }]);
    expect(byTopic.size).toBe(0);
  });
});

describe('classifyCalibration', () => {
  it('flags a confident wrong answer as high-confidence-error', () => {
    expect(classifyCalibration('sure', false)).toBe('high-confidence-error');
  });

  it('flags a correct guess as fragile-correct', () => {
    expect(classifyCalibration('guess', true)).toBe('fragile-correct');
  });

  it('flags a correct unsure answer as fragile-correct', () => {
    expect(classifyCalibration('unsure', true)).toBe('fragile-correct');
  });

  it('flags a correct sure answer as none', () => {
    expect(classifyCalibration('sure', true)).toBe('none');
  });

  it('flags a wrong guess as none', () => {
    expect(classifyCalibration('guess', false)).toBe('none');
  });

  it('flags a wrong unsure answer as none', () => {
    expect(classifyCalibration('unsure', false)).toBe('none');
  });
});

describe('calibrationPriority', () => {
  it('ranks high-confidence-error above fragile-correct above none', () => {
    expect(calibrationPriority('high-confidence-error')).toBeGreaterThan(
      calibrationPriority('fragile-correct'),
    );
    expect(calibrationPriority('fragile-correct')).toBeGreaterThan(calibrationPriority('none'));
  });

  it('sorts a mixed list of flags into descending priority order', () => {
    const flags: Array<'high-confidence-error' | 'fragile-correct' | 'none'> = [
      'none',
      'high-confidence-error',
      'fragile-correct',
    ];
    const sorted = [...flags].sort(
      (left, right) => calibrationPriority(right) - calibrationPriority(left),
    );
    expect(sorted).toEqual(['high-confidence-error', 'fragile-correct', 'none']);
  });
});
