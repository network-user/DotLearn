export type ConfidenceLevel = 'sure' | 'unsure' | 'guess';

// Nominal probability of being correct that each confidence level claims.
export const NOMINAL_CONFIDENCE: Record<ConfidenceLevel, number> = {
  sure: 0.9,
  unsure: 0.55,
  guess: 0.3,
};

const CONFIDENCE_LEVELS: readonly ConfidenceLevel[] = ['sure', 'unsure', 'guess'];

export interface CalibrationSample {
  confidence: ConfidenceLevel;
  correct: boolean;
  topicSlug?: string;
}

export interface ConfidenceBucketStats {
  confidence: ConfidenceLevel;
  count: number;
  correct: number;
  accuracy: number;
  expectedAccuracy: number;
  gap: number;
}

export interface CalibrationSummary {
  total: number;
  buckets: ConfidenceBucketStats[];
  overconfidenceRate: number;
  underconfidenceRate: number;
  brier: number;
  calibrationScore: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const summarizeCalibration = (samples: readonly CalibrationSample[]): CalibrationSummary => {
  const counts = new Map<ConfidenceLevel, { count: number; correct: number }>(
    CONFIDENCE_LEVELS.map((level) => [level, { count: 0, correct: 0 }]),
  );

  let sureTotal = 0;
  let sureWrong = 0;
  let lowConfidenceTotal = 0;
  let lowConfidenceCorrect = 0;
  let brierSum = 0;

  for (const sample of samples) {
    const bucket = counts.get(sample.confidence);
    if (!bucket) continue;
    bucket.count += 1;
    if (sample.correct) bucket.correct += 1;

    if (sample.confidence === 'sure') {
      sureTotal += 1;
      if (!sample.correct) sureWrong += 1;
    } else {
      lowConfidenceTotal += 1;
      if (sample.correct) lowConfidenceCorrect += 1;
    }

    const nominal = NOMINAL_CONFIDENCE[sample.confidence];
    const outcome = sample.correct ? 1 : 0;
    brierSum += (nominal - outcome) ** 2;
  }

  const buckets: ConfidenceBucketStats[] = CONFIDENCE_LEVELS.map((confidence) => {
    const bucket = counts.get(confidence);
    const count = bucket?.count ?? 0;
    const correct = bucket?.correct ?? 0;
    const accuracy = count === 0 ? 0 : correct / count;
    const expectedAccuracy = NOMINAL_CONFIDENCE[confidence];
    return {
      confidence,
      count,
      correct,
      accuracy,
      expectedAccuracy,
      gap: accuracy - expectedAccuracy,
    };
  });

  const total = samples.length;
  const brier = total === 0 ? 0 : brierSum / total;
  const calibrationScore = total === 0 ? 1 : clamp(1 - Math.sqrt(brier), 0, 1);

  return {
    total,
    buckets,
    overconfidenceRate: sureTotal === 0 ? 0 : sureWrong / sureTotal,
    underconfidenceRate: lowConfidenceTotal === 0 ? 0 : lowConfidenceCorrect / lowConfidenceTotal,
    brier,
    calibrationScore,
  };
};

export const calibrationByTopic = (
  samples: readonly CalibrationSample[],
): Map<string, CalibrationSummary> => {
  const byTopic = new Map<string, CalibrationSample[]>();
  for (const sample of samples) {
    if (!sample.topicSlug) continue;
    const existing = byTopic.get(sample.topicSlug);
    if (existing) {
      existing.push(sample);
    } else {
      byTopic.set(sample.topicSlug, [sample]);
    }
  }

  const result = new Map<string, CalibrationSummary>();
  for (const [topicSlug, topicSamples] of byTopic) {
    result.set(topicSlug, summarizeCalibration(topicSamples));
  }
  return result;
};

export type CalibrationFlag = 'high-confidence-error' | 'fragile-correct' | 'none';

export const classifyCalibration = (
  confidence: ConfidenceLevel,
  correct: boolean,
): CalibrationFlag => {
  if (confidence === 'sure' && !correct) return 'high-confidence-error';
  if ((confidence === 'unsure' || confidence === 'guess') && correct) return 'fragile-correct';
  return 'none';
};

const CALIBRATION_FLAG_PRIORITY: Record<CalibrationFlag, number> = {
  'high-confidence-error': 2,
  'fragile-correct': 1,
  none: 0,
};

export const calibrationPriority = (flag: CalibrationFlag): number =>
  CALIBRATION_FLAG_PRIORITY[flag];
