import type { PredictOutputExercise } from '@dotlearn/contracts';
import { describe, expect, it } from 'vitest';

import { runPredictOutput } from './predict-output';

const base = {
  id: 'p1',
  concept: 'basics',
  difficulty: 1,
  prompt: 'Predict the output',
  type: 'predict-output' as const,
  snippet: 'print(1 + 1)',
};

describe('runPredictOutput', () => {
  describe('scalar', () => {
    const exercise: PredictOutputExercise = { ...base, expected: { kind: 'scalar', value: 2 } };

    it('passes an equal value', () => {
      expect(runPredictOutput(exercise, 2).ok).toBe(true);
    });

    it('fails a different value', () => {
      const result = runPredictOutput(exercise, 3);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('expected failure');
      expect(result.code).toBe('predict-value-differs');
    });
  });

  describe('stdout', () => {
    const exercise: PredictOutputExercise = { ...base, expected: { kind: 'stdout', value: '2\n' } };

    it('passes equal stdout', () => {
      expect(runPredictOutput(exercise, '2\n').ok).toBe(true);
    });

    it('rejects a non-string answer', () => {
      expect(runPredictOutput(exercise, 2).ok).toBe(false);
    });

    it('fails differing stdout', () => {
      const result = runPredictOutput(exercise, '3\n');
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('expected failure');
      expect(result.code).toBe('predict-stdout-differs');
    });
  });

  describe('result-set', () => {
    const exercise: PredictOutputExercise = {
      ...base,
      expected: { kind: 'result-set', ordered: false, rows: [{ n: 1 }, { n: 2 }] },
    };

    it('passes matching rows regardless of order', () => {
      expect(runPredictOutput(exercise, [{ n: 2 }, { n: 1 }]).ok).toBe(true);
    });

    it('rejects a non-array answer', () => {
      expect(runPredictOutput(exercise, 'nope').ok).toBe(false);
    });

    it('fails on a row mismatch', () => {
      const result = runPredictOutput(exercise, [{ n: 1 }]);
      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('expected failure');
      expect(result.code).toBe('predict-rows-mismatch');
    });
  });
});
