import {
  calibrationPriority,
  classifyCalibration,
  isCardDue,
  isReExamDue,
  type CalibrationFlag,
} from '@dotlearn/lesson-engine';

import type { SupportedLanguage } from './i18n';
import { flashcardTopicSlugs, loadTopicCards, type DeckCard } from './flashcard-decks';
import { interviewFlashcardSlug, loadInterviewCards } from './interview-flashcards';
import { db, type AttemptEventRecord } from './progress-db';
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

export interface DueReExam {
  topicSlug: string;
  topicTitle: string;
  conceptId: string;
  conceptTitle: string;
  due: string;
  stepIndex: number;
  streak: number;
}

export interface CalibrationReviewItem {
  topicSlug: string;
  topicTitle: string;
  exerciseId: string;
  exerciseTitle: string;
  conceptId?: string;
  flag: CalibrationFlag;
}

export class TodayLoadError extends Error {
  override readonly name = 'TodayLoadError';
  constructor(scope: 'due' | 'mistakes' | 'reexam' | 'calibration', cause: unknown) {
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

export const loadDueAcrossDecks = async (language: SupportedLanguage): Promise<DueCard[]> => {
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
    const exerciseIndex = new Map<string, { conceptId: string; prompt: string; type: string }>();
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

export const loadDueReExams = async (language: SupportedLanguage): Promise<DueReExam[]> => {
  try {
    const now = new Date();
    const records = await db.reExamSchedule.toArray();
    const due = records.filter((record) => !record.graduated && isReExamDue(record, now));
    if (due.length === 0) return [];

    const slugs = [...new Set(due.map((record) => record.topicSlug))];
    const bundles = await Promise.all(
      slugs.map(async (slug) => {
        try {
          return { slug, bundle: await loadTopic(slug, language) };
        } catch {
          return { slug, bundle: undefined };
        }
      }),
    );
    const conceptTitleIndex = new Map<string, string>();
    for (const entry of bundles) {
      if (!entry.bundle) continue;
      for (const concept of entry.bundle.manifest.concepts) {
        conceptTitleIndex.set(`${entry.slug}:${concept.id}`, concept.title);
      }
    }

    const out: DueReExam[] = [];
    for (const record of due) {
      const conceptTitle = conceptTitleIndex.get(`${record.topicSlug}:${record.conceptId}`);
      if (!conceptTitle) continue;
      out.push({
        topicSlug: record.topicSlug,
        topicTitle: topicTitleOf(record.topicSlug) ?? record.topicSlug,
        conceptId: record.conceptId,
        conceptTitle,
        due: record.due,
        stepIndex: record.stepIndex,
        streak: record.streak,
      });
    }
    return out.sort((a, b) => a.due.localeCompare(b.due));
  } catch (error) {
    throw new TodayLoadError('reexam', error);
  }
};

type ConfidentAttemptEvent = AttemptEventRecord & Required<Pick<AttemptEventRecord, 'confidence'>>;

export const loadCalibrationReview = async (
  language: SupportedLanguage,
): Promise<CalibrationReviewItem[]> => {
  try {
    const events = await db.attemptEvents.toArray();
    const withConfidence = events.filter(
      (event): event is ConfidentAttemptEvent => event.confidence !== undefined,
    );

    const latestByKey = new Map<string, ConfidentAttemptEvent>();
    for (const event of withConfidence) {
      const key = `${event.topicSlug}:${event.exerciseId}`;
      const existing = latestByKey.get(key);
      if (
        !existing ||
        event.at > existing.at ||
        (event.at === existing.at && (event.id ?? 0) > (existing.id ?? 0))
      ) {
        latestByKey.set(key, event);
      }
    }

    const flagged = [...latestByKey.values()]
      .map((event) => ({
        event,
        flag: classifyCalibration(event.confidence, event.status === 'pass'),
      }))
      .filter((entry) => entry.flag !== 'none');
    if (flagged.length === 0) return [];

    const slugs = [...new Set(flagged.map((entry) => entry.event.topicSlug))];
    const bundles = await Promise.all(
      slugs.map(async (slug) => {
        try {
          return { slug, bundle: await loadTopic(slug, language) };
        } catch {
          return { slug, bundle: undefined };
        }
      }),
    );
    const exerciseIndex = new Map<string, { conceptId: string; prompt: string }>();
    for (const entry of bundles) {
      if (!entry.bundle) continue;
      for (const concept of entry.bundle.concepts) {
        for (const file of concept.exercises) {
          for (const exercise of file.exercises) {
            exerciseIndex.set(`${entry.slug}:${exercise.id}`, {
              conceptId: exercise.concept,
              prompt: exercise.prompt,
            });
          }
        }
      }
    }

    const scored: { item: CalibrationReviewItem; at: string }[] = [];
    for (const { event, flag } of flagged) {
      const resolved = exerciseIndex.get(`${event.topicSlug}:${event.exerciseId}`);
      if (!resolved) continue;
      scored.push({
        at: event.at,
        item: {
          topicSlug: event.topicSlug,
          topicTitle: topicTitleOf(event.topicSlug) ?? event.topicSlug,
          exerciseId: event.exerciseId,
          exerciseTitle: resolved.prompt,
          ...(resolved.conceptId ? { conceptId: resolved.conceptId } : {}),
          flag,
        },
      });
    }

    return scored
      .sort((a, b) => {
        const priorityDiff = calibrationPriority(b.item.flag) - calibrationPriority(a.item.flag);
        return priorityDiff !== 0 ? priorityDiff : b.at.localeCompare(a.at);
      })
      .slice(0, 12)
      .map((entry) => entry.item);
  } catch (error) {
    throw new TodayLoadError('calibration', error);
  }
};
