import { describe, expect, it } from 'vitest';

import { indexExerciseLocations, locateExercise } from './yaml-locator';

const sample = `exercises:
  - id: first-001
    concept: intro
    type: theory-quiz
  - id: second-002
    concept: intro
    type: sql-query
  - id: third-003
    concept: intro
    type: python-function
`;

describe('indexExerciseLocations', () => {
  it('maps each exercise id to the line where its id key appears', () => {
    const index = indexExerciseLocations(sample);
    expect(index.byId.get('first-001')?.line).toBe(2);
    expect(index.byId.get('second-002')?.line).toBe(5);
    expect(index.byId.get('third-003')?.line).toBe(8);
  });

  it('reports a 1-based column for the id node', () => {
    const index = indexExerciseLocations(sample);
    expect(index.byId.get('first-001')?.column).toBeGreaterThan(0);
  });

  it('returns an empty index for malformed YAML', () => {
    const index = indexExerciseLocations('exercises: [unterminated');
    expect(index.byId.size).toBe(0);
  });

  it('returns an empty index when the top level is not a map', () => {
    expect(indexExerciseLocations('- just\n- a\n- list\n').byId.size).toBe(0);
  });

  it('returns an empty index when exercises is not a sequence', () => {
    expect(indexExerciseLocations('exercises: notalist\n').byId.size).toBe(0);
  });

  it('skips items without a string id', () => {
    const index = indexExerciseLocations('exercises:\n  - concept: intro\n  - id: only-002\n');
    expect(index.byId.has('only-002')).toBe(true);
    expect(index.byId.size).toBe(1);
  });

  it('locates the most recent id when ids repeat', () => {
    const index = indexExerciseLocations('exercises:\n  - id: dup\n  - id: dup\n');
    expect(index.byId.get('dup')?.line).toBe(3);
  });
});

describe('locateExercise', () => {
  it('returns the location for a known id', () => {
    const index = indexExerciseLocations(sample);
    expect(locateExercise(index, 'second-002')?.line).toBe(5);
  });

  it('returns undefined for an unknown id', () => {
    const index = indexExerciseLocations(sample);
    expect(locateExercise(index, 'missing')).toBeUndefined();
  });

  it('returns undefined when the index is undefined', () => {
    expect(locateExercise(undefined, 'first-001')).toBeUndefined();
  });
});
