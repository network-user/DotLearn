import type { TopicLanguage } from '@dotlearn/contracts';

import { loadTopicCards } from './flashcard-decks';

export interface FreeRecallKeyPoint {
  cue: string;
  detail?: string | undefined;
}

/**
 * Key points to check yourself against during the free-recall review phase, sourced from the
 * concept's flashcard deck (front -> cue, back -> detail). Any loading error yields an empty
 * array so the caller can fall back to DOM headings or the overall (no-items) mode.
 */
export const loadConceptFlashcardPoints = async (
  slug: string,
  conceptId: string,
  language: TopicLanguage,
): Promise<FreeRecallKeyPoint[]> => {
  try {
    const cards = await loadTopicCards(slug, language);
    return cards
      .filter((card) => card.conceptId === conceptId)
      .map((card) => ({
        cue: card.front,
        ...(card.back ? { detail: card.back } : {}),
      }));
  } catch {
    return [];
  }
};
