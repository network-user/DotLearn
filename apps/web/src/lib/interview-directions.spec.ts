import { describe, expect, it } from 'vitest';

import {
  categoriesForDirection,
  directionLabel,
  getInterviewDirections,
  isInterviewDirection,
  resolveInterviewDirection,
} from './interview-directions';

describe('resolveInterviewDirection', () => {
  it('maps legacy python categories', () => {
    expect(resolveInterviewDirection('concurrency')).toBe('python');
    expect(resolveInterviewDirection('python-core')).toBe('python');
  });

  it('maps prefixed track categories', () => {
    expect(resolveInterviewDirection('go-tipy-i-kollektsii')).toBe('go');
    expect(resolveInterviewDirection('frontend-html-i-verstka')).toBe('frontend');
    expect(resolveInterviewDirection('java-java-core')).toBe('java');
    expect(resolveInterviewDirection('onec-dev-bazy-dannyh-1c')).toBe('1c');
    expect(resolveInterviewDirection('cpp-shablony-metaprogramming')).toBe('cpp');
    expect(resolveInterviewDirection('devops-docker-konteynery')).toBe('devops');
    expect(resolveInterviewDirection('qa-http-rest-soap-websocket-i-api')).toBe('qa');
    expect(resolveInterviewDirection('aqa-java')).toBe('aqa');
  });

  it('returns undefined for unknown categories', () => {
    expect(resolveInterviewDirection('unknown-track')).toBeUndefined();
  });
});

describe('getInterviewDirections', () => {
  it('lists all nine directions', () => {
    expect(getInterviewDirections().map((entry) => entry.id)).toEqual([
      'python',
      'go',
      'frontend',
      'java',
      '1c',
      'cpp',
      'devops',
      'qa',
      'aqa',
    ]);
  });
});

describe('isInterviewDirection', () => {
  it('accepts known ids and rejects unknown', () => {
    expect(isInterviewDirection('go')).toBe(true);
    expect(isInterviewDirection('invalid')).toBe(false);
  });
});

describe('directionLabel', () => {
  it('returns locale-specific labels', () => {
    expect(directionLabel('1c', 'ru')).toBe('1С');
    expect(directionLabel('1c', 'en')).toBe('1C');
  });
});

describe('categoriesForDirection', () => {
  it('filters categories by resolved direction', () => {
    const categories = ['concurrency', 'go-tipy-i-kollektsii', 'aqa-java'];
    expect(categoriesForDirection('python', categories)).toEqual(['concurrency']);
    expect(categoriesForDirection('go', categories)).toEqual(['go-tipy-i-kollektsii']);
  });
});
