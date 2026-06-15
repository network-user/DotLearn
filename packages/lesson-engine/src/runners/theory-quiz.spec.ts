import type { TheoryQuizExercise } from '@dotlearn/contracts';
import { describe, expect, it } from 'vitest';

import { runTheoryQuiz } from './theory-quiz';

const quiz = (overrides: Partial<TheoryQuizExercise> = {}): TheoryQuizExercise => ({
  id: 'q1',
  concept: 'basics',
  difficulty: 1,
  prompt: 'Pick the correct options',
  type: 'theory-quiz',
  choices: [
    { id: 'a', text: 'Option A' },
    { id: 'b', text: 'Option B' },
    { id: 'c', text: 'Option C' },
  ],
  correct: ['a', 'b'],
  ...overrides,
});

describe('runTheoryQuiz', () => {
  it('passes when the chosen set equals the correct set', () => {
    expect(runTheoryQuiz(quiz(), ['a', 'b']).ok).toBe(true);
  });

  it('is order independent', () => {
    expect(runTheoryQuiz(quiz(), ['b', 'a']).ok).toBe(true);
  });

  it('includes the explanation in pass details when present', () => {
    expect(runTheoryQuiz(quiz({ explanation: 'because' }), ['a', 'b'])).toEqual({
      ok: true,
      details: { explanation: 'because' },
    });
  });

  it('fails with the missing and unexpected choices', () => {
    const result = runTheoryQuiz(quiz(), ['a', 'c']);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.code).toBe('quiz-incorrect');
    expect(result.details).toMatchObject({ missing: ['b'], unexpected: ['c'] });
  });
});
