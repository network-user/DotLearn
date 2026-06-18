import { describe, expect, it } from 'vitest';

import { classifyCard, isCardDue } from './due';

const now = new Date('2026-06-17T12:00:00.000Z');

describe('isCardDue', () => {
  it('treats a never-reviewed card as due', () => {
    expect(isCardDue(undefined, now)).toBe(true);
  });

  it('treats a card due in the past as due', () => {
    expect(isCardDue({ due: '2026-06-17T11:59:59.999Z' }, now)).toBe(true);
  });

  it('treats a card due in the future as not due', () => {
    expect(isCardDue({ due: '2026-06-17T12:00:00.001Z' }, now)).toBe(false);
  });

  it('treats a card due exactly now as due', () => {
    expect(isCardDue({ due: '2026-06-17T12:00:00.000Z' }, now)).toBe(true);
  });
});

describe('classifyCard', () => {
  it('classifies a never-reviewed card as new', () => {
    expect(classifyCard(undefined, now)).toBe('new');
  });

  it('classifies a card due in the past as due', () => {
    expect(classifyCard({ due: '2026-06-17T11:59:59.999Z' }, now)).toBe('due');
  });

  it('classifies a card due in the future as later', () => {
    expect(classifyCard({ due: '2026-06-17T12:00:00.001Z' }, now)).toBe('later');
  });

  it('classifies a card due exactly now as due', () => {
    expect(classifyCard({ due: '2026-06-17T12:00:00.000Z' }, now)).toBe('due');
  });
});
