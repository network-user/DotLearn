import type { FillInBlanksExercise } from '@dotlearn/contracts';
import { describe, expect, it } from 'vitest';

import { runFillInBlanks } from './fill-in-blanks';

const exercise = (blanks: FillInBlanksExercise['blanks']): FillInBlanksExercise => ({
  id: 'f1',
  concept: 'basics',
  difficulty: 1,
  prompt: 'Fill the blanks',
  type: 'fill-in-blanks',
  template: 'SELECT __1__ FROM __2__',
  blanks,
});

describe('runFillInBlanks', () => {
  it('passes when every blank is in its accept list', () => {
    const result = runFillInBlanks(exercise({ 1: { accept: ['*'] }, 2: { accept: ['users'] } }), {
      1: '*',
      2: 'users',
    });
    expect(result.ok).toBe(true);
  });

  it('passes when a blank matches accept_regex', () => {
    expect(runFillInBlanks(exercise({ 1: { accept_regex: '^[0-9]+$' } }), { 1: '42' }).ok).toBe(
      true,
    );
  });

  it('fails a missing blank', () => {
    const result = runFillInBlanks(exercise({ 1: { accept: ['x'] } }), {});
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.code).toBe('blanks-incorrect');
    expect(result.details).toMatchObject({ failures: [{ blank: '1', reason: 'missing' }] });
  });

  it('fails a value that does not match', () => {
    const result = runFillInBlanks(exercise({ 1: { accept: ['x'] } }), { 1: 'y' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.details).toMatchObject({
      failures: [{ blank: '1', got: 'y', reason: 'no-match' }],
    });
  });

  it('treats an invalid regex as no-match instead of throwing', () => {
    const result = runFillInBlanks(exercise({ 1: { accept_regex: '(' } }), { 1: 'anything' });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.details).toMatchObject({ failures: [{ blank: '1', reason: 'no-match' }] });
  });
});
