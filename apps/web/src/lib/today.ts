import type { SupportedLanguage } from './i18n';
import { flashcardTopicSlugs, loadTopicCards, type DeckCard } from './flashcard-decks';
import { db } from './progress-db';
import { loadTopic, topicTitleOf } from './topics';

export interface DueCard {
  slug: string;
  title: string;
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

export const loadDueAcrossDecks = async (
  language: SupportedLanguage,
): Promise<DueCard[]> => {
  const now = Date.now();
  const slugs = flashcardTopicSlugs();
  const perTopic = await Promise.all(
    slugs.map(async (slug) => {
      const [cards, records] = await Promise.all([
        loadTopicCards(slug, language),
        db.flashcardReviews.where('topicSlug').equals(slug).toArray(),
      ]);
      const byCard = new Map(records.map((record) => [record.cardId, record]));
      const title = topicTitleOf(slug) ?? slug;
      return cards
        .filter((card) => {
          const record = byCard.get(card.id);
          return !record || new Date(record.due).getTime() <= now;
        })
        .map((card) => ({ slug, title, card }));
    }),
  );
  return perTopic.flat();
};

export const loadFailedExercises = async (
  language: SupportedLanguage,
): Promise<FailedExercise[]> => {
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
};
