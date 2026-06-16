import { describe, expect, it } from 'vitest';

import { Flashcard, FlashcardDeck } from './flashcard.schema';

const validDeck = {
  conceptId: 'merging',
  cards: [
    { id: 'merging-01', front: 'Что делает git merge?', back: 'Сводит ветки.', tags: ['basics'] },
    { id: 'merging-02', front: 'Что такое 3-way merge?', back: 'Слияние через предка.' },
  ],
};

describe('FlashcardDeck schema', () => {
  it('parses a valid deck', () => {
    const result = FlashcardDeck.safeParse(validDeck);
    expect(result.success).toBe(true);
  });

  it('rejects a tag that does not start with a letter', () => {
    const deck = {
      conceptId: 'merging',
      cards: [{ id: 'merging-01', front: 'front text', back: 'back text', tags: ['3way'] }],
    };
    expect(FlashcardDeck.safeParse(deck).success).toBe(false);
  });

  it('accepts a letter-leading tag with digits and hyphens', () => {
    expect(Flashcard.safeParse({ id: 'c-1', front: 'aaa', back: 'bbb', tags: ['three-way'] }).success).toBe(
      true,
    );
  });

  it('rejects an empty deck', () => {
    expect(FlashcardDeck.safeParse({ conceptId: 'merging', cards: [] }).success).toBe(false);
  });

  it('rejects unknown top-level keys (strict)', () => {
    expect(FlashcardDeck.safeParse({ ...validDeck, extra: true }).success).toBe(false);
  });

  it('rejects a conceptId that is not a slug', () => {
    expect(FlashcardDeck.safeParse({ ...validDeck, conceptId: 'Merging' }).success).toBe(false);
  });

  it('rejects front/back shorter than 3 chars', () => {
    expect(Flashcard.safeParse({ id: 'c-1', front: 'ok', back: 'also ok' }).success).toBe(false);
  });

  it('rejects an id with uppercase or spaces', () => {
    expect(Flashcard.safeParse({ id: 'Merging 01', front: 'aaa', back: 'bbb' }).success).toBe(false);
  });
});
