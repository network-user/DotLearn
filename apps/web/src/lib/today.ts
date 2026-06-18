import { isCardDue } from '@dotlearn/lesson-engine';

import type { SupportedLanguage } from './i18n';
import { flashcardTopicSlugs, loadTopicCards, type DeckCard } from './flashcard-decks';
import { interviewFlashcardSlug, loadInterviewCards } from './interview-flashcards';
import { db } from './progress-db';
import { loadTopic, topicTitleOf } from './topics';

export interface DueCard {
  deckSlug: string;
  title: string;
  sourceLabel: string;
  card: DeckCard;
}

export interface FailedExercise {
  slug: string;
  title: string;
  conceptId: string;
  exerciseId: string;
  prompt: string;
  type: string;
}

export class TodayLoadError extends Error {
  override readonly name = 'TodayLoadError';
  constructor(scope: 'due' | 'mistakes', cause: unknown) {
    super(`failed to load ${scope} data`, { cause });
  }
}

const dueFromCards = (
  deckSlug: string,
  title: string,
  sourceLabel: string,
  cards: DeckCard[],
  records: Map<string, { due: string }>,
  now: Date,
): DueCard[] =>
  cards
    .filter((card) => isCardDue(records.get(`${deckSlug}:${card.id}`), now))
    .map((card) => ({ deckSlug, title, sourceLabel, card }));

export const loadDueAcrossDecks = async (
  language: SupportedLanguage,
): Promise<DueCard[]> => {
  try {
    const now = new Date();
    const allRecords = await db.flashcardReviews.toArray();
    const byKey = new Map(
      allRecords.map((record) => [`${record.topicSlug}:${record.cardId}`, record]),
    );

    const slugs = flashcardTopicSlugs();
    const topicDue = await Promise.all(
      slugs.map(async (slug) => {
        try {
          const cards = await loadTopicCards(slug, language);
          const title = topicTitleOf(slug) ?? slug;
          return dueFromCards(slug, title, title, cards, byKey, now);
        } catch {
          return [] as DueCard[];
        }
      }),
    );

    const interviewSlug = interviewFlashcardSlug();
    const interviewCards = await loadInterviewCards(language);
    const interviewDue = interviewCards
      .filter((card) => isCardDue(byKey.get(`${interviewSlug}:${card.id}`), now))
      .map((card) => ({
        deckSlug: interviewSlug,
        title: card.front,
        sourceLabel: card.categoryLabel,
        card,
      }));

    return [...topicDue.flat(), ...interviewDue];
  } catch (error) {
    throw new TodayLoadError('due', error);
  }
};

export const loadFailedExercises = async (
  language: SupportedLanguage,
): Promise<FailedExercise[]> => {
  try {
    const records = await db.progress.toArray();
    const failed = records.filter((record) => record.status === 'fail');
    const slugs = [...new Set(failed.map((record) => record.topicSlug))];
    const bundles = await Promise.all(
      slugs.map(async (slug) => {
        try {
          return { slug, bundle: await loadTopic(slug, language) };
        } catch {
          return { slug, bundle: undefined };
        }
      }),
    );
    const exerciseIndex = new Map<
      string,
      { conceptId: string; prompt: string; type: string }
    >();
    for (const entry of bundles) {
      if (!entry.bundle) continue;
      for (const concept of entry.bundle.concepts) {
        for (const file of concept.exercises) {
          for (const exercise of file.exercises) {
            exerciseIndex.set(`${entry.slug}:${exercise.id}`, {
              conceptId: exercise.concept,
              prompt: exercise.prompt,
              type: exercise.type,
            });
          }
        }
      }
    }
    const out: FailedExercise[] = [];
    for (const record of failed) {
      const resolved = exerciseIndex.get(`${record.topicSlug}:${record.exerciseId}`);
      if (!resolved) continue;
      out.push({
        slug: record.topicSlug,
        title: topicTitleOf(record.topicSlug) ?? record.topicSlug,
        conceptId: resolved.conceptId,
        exerciseId: record.exerciseId,
        prompt: resolved.prompt,
        type: resolved.type,
      });
    }
    return out;
  } catch (error) {
    throw new TodayLoadError('mistakes', error);
  }
};
