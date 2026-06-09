import { z } from 'zod';

import { SLUG_PATTERN, TAG_PATTERN } from './topic.schema';

export const Flashcard = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  front: z.string().min(3),
  back: z.string().min(3),
  tags: z.array(z.string().regex(TAG_PATTERN)).optional(),
});
export type Flashcard = z.infer<typeof Flashcard>;

export const FlashcardDeck = z
  .object({
    conceptId: z.string().regex(SLUG_PATTERN),
    cards: z.array(Flashcard).min(1),
  })
  .strict();
export type FlashcardDeck = z.infer<typeof FlashcardDeck>;
