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

    it('accepts the same text without a trailing newline', () => {
      // YAML `|` and Python print always leave a final \n; learners type without it.
      expect(runPredictOutput(exercise, '2').ok).toBe(true);
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

    describe('code-ish leniency', () => {
      const listExercise: PredictOutputExercise = {
        ...base,
        expected: { kind: 'stdout', value: "['a', 'b']\n" },
      };

      it('accepts differing quote style and intra-line spacing', () => {
        expect(runPredictOutput(listExercise, "['a','b']\n").ok).toBe(true);
        expect(runPredictOutput(listExercise, '[ "a" , "b" ]\n').ok).toBe(true);
      });

      it('accepts a list answer that matches after dropping the YAML trailing newline', () => {
        expect(runPredictOutput(listExercise, "['a', 'b']").ok).toBe(true);
        expect(runPredictOutput(listExercise, "['_A__id']").ok).toBe(false);
        const mangling: PredictOutputExercise = {
          ...base,
          expected: { kind: 'stdout', value: "['_A__id']\n" },
        };
        expect(runPredictOutput(mangling, "['_A__id']").ok).toBe(true);
        expect(runPredictOutput(mangling, '["_A__id"]').ok).toBe(true);
      });

      it('still fails a genuinely different value', () => {
        const result = runPredictOutput(listExercise, "['a','c']\n");
        expect(result.ok).toBe(false);
        if (result.ok) throw new Error('expected failure');
        expect(result.code).toBe('predict-stdout-differs');
      });

      it('still fails when the line count differs', () => {
        const multiline: PredictOutputExercise = {
          ...base,
          expected: { kind: 'stdout', value: '1\n2\n' },
        };
        const result = runPredictOutput(multiline, '1 2\n');
        expect(result.ok).toBe(false);
        if (result.ok) throw new Error('expected failure');
        expect(result.code).toBe('predict-stdout-differs');
      });

      it('accepts multiline stdout without a final trailing newline', () => {
        const multiline: PredictOutputExercise = {
          ...base,
          expected: { kind: 'stdout', value: '1\n2\n' },
        };
        expect(runPredictOutput(multiline, '1\n2').ok).toBe(true);
      });
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
