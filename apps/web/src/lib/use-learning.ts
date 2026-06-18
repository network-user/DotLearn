import { isCardDue } from '@dotlearn/lesson-engine';
import { useLiveQuery } from 'dexie-react-hooks';

import {
  db,
  USER_CARDS_DECK_SLUG,
  type BookmarkRecord,
  type ConceptNoteRecord,
  type ConceptScrollRecord,
  type HighlightRecord,
  type TopicPlaceRecord,
  type UserCardRecord,
} from './progress-db';

const conceptKey = (topicSlug: string, conceptId: string): string => `${topicSlug}:${conceptId}`;

export const useLastPlace = (): TopicPlaceRecord | undefined =>
  useLiveQuery(async () => {
    const places = await db.topicPlace.orderBy('updatedAt').reverse().limit(1).toArray();
    return places[0];
  }, []);

export const useTopicPlace = (topicSlug: string): TopicPlaceRecord | undefined =>
  useLiveQuery(() => db.topicPlace.get(topicSlug), [topicSlug]);

export const useConceptNote = (
  topicSlug: string,
  conceptId: string | undefined,
): ConceptNoteRecord | undefined =>
  useLiveQuery(
    () => (conceptId === undefined ? undefined : db.conceptNotes.get(`${topicSlug}:${conceptId}`)),
    [topicSlug, conceptId],
  );

export const useConceptBookmarked = (topicSlug: string, conceptId: string | undefined): boolean =>
  useLiveQuery(
    async () => {
      if (conceptId === undefined) return false;
      const record = await db.bookmarks.get(`${topicSlug}:${conceptId}`);
      return record !== undefined;
    },
    [topicSlug, conceptId],
    false,
  );

export const useBookmarks = (): BookmarkRecord[] => {
  const records = useLiveQuery(() => db.bookmarks.orderBy('createdAt').reverse().toArray(), [], []);
  return records ?? [];
};

export const useTopicNotedConceptIds = (topicSlug: string): Set<string> => {
  const records = useLiveQuery(
    () => db.conceptNotes.where('topicSlug').equals(topicSlug).toArray(),
    [topicSlug],
    [],
  );
  return new Set((records ?? []).map((record) => record.conceptId));
};

export const useTopicBookmarkedConceptIds = (topicSlug: string): Set<string> => {
  const records = useLiveQuery(
    () => db.bookmarks.where('topicSlug').equals(topicSlug).toArray(),
    [topicSlug],
    [],
  );
  return new Set((records ?? []).map((record) => record.conceptId));
};

export const useConceptRead = (topicSlug: string, conceptId: string | undefined): boolean =>
  useLiveQuery(
    async () => {
      if (conceptId === undefined) return false;
      const record = await db.conceptRead.get(conceptKey(topicSlug, conceptId));
      return record !== undefined;
    },
    [topicSlug, conceptId],
    false,
  );

export const useTopicReadConceptIds = (topicSlug: string): Set<string> => {
  const records = useLiveQuery(
    () => db.conceptRead.where('topicSlug').equals(topicSlug).toArray(),
    [topicSlug],
    [],
  );
  return new Set((records ?? []).map((record) => record.conceptId));
};

export const useAllNotedKeys = (): Set<string> => {
  const records = useLiveQuery(() => db.conceptNotes.toArray(), [], []);
  return new Set((records ?? []).map((record) => record.id));
};

export const useReadingScroll = (
  topicSlug: string,
  conceptId: string | undefined,
): ConceptScrollRecord | null | undefined =>
  useLiveQuery(async () => {
    if (conceptId === undefined) return null;
    return (await db.conceptScroll.get(conceptKey(topicSlug, conceptId))) ?? null;
  }, [topicSlug, conceptId]);

export const useConceptHighlights = (
  topicSlug: string,
  conceptId: string | undefined,
): HighlightRecord[] => {
  const records = useLiveQuery(
    () => {
      if (conceptId === undefined) return [];
      return db.highlights.where('[topicSlug+conceptId]').equals([topicSlug, conceptId]).toArray();
    },
    [topicSlug, conceptId],
    [],
  );
  return records ?? [];
};

export const useAllHighlights = (): HighlightRecord[] => {
  const records = useLiveQuery(
    () => db.highlights.orderBy('createdAt').reverse().toArray(),
    [],
    [],
  );
  return records ?? [];
};

export const useAllNotes = (): ConceptNoteRecord[] => {
  const records = useLiveQuery(
    () => db.conceptNotes.orderBy('updatedAt').reverse().toArray(),
    [],
    [],
  );
  return records ?? [];
};

export const useUserCards = (): UserCardRecord[] => {
  const records = useLiveQuery(() => db.userCards.orderBy('createdAt').reverse().toArray(), [], []);
  return records ?? [];
};

export const useDueUserCardCount = (): number => {
  const count = useLiveQuery(
    async () => {
      const [records, reviews] = await Promise.all([
        db.userCards.toArray(),
        db.flashcardReviews.where('topicSlug').equals(USER_CARDS_DECK_SLUG).toArray(),
      ]);
      const byKey = new Map(reviews.map((review) => [review.cardId, review]));
      const now = new Date();
      return records.filter((record) => isCardDue(byKey.get(record.id), now)).length;
    },
    [],
    0,
  );
  return count ?? 0;
};

export const useLibraryTags = (): string[] => {
  const tags = useLiveQuery(
    async () => {
      const [notes, bookmarks] = await Promise.all([
        db.conceptNotes.toArray(),
        db.bookmarks.toArray(),
      ]);
      const counts = new Map<string, { label: string; count: number }>();
      for (const record of [...notes, ...bookmarks]) {
        for (const tag of record.tags ?? []) {
          const key = tag.toLowerCase();
          const entry = counts.get(key);
          if (entry) {
            entry.count += 1;
          } else {
            counts.set(key, { label: tag, count: 1 });
          }
        }
      }
      return [...counts.values()]
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
        .map((entry) => entry.label);
    },
    [],
    [],
  );
  return tags ?? [];
};
