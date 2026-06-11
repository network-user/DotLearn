import { useLiveQuery } from 'dexie-react-hooks';

import {
  db,
  type BookmarkRecord,
  type ConceptNoteRecord,
  type TopicPlaceRecord,
} from './progress-db';

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
    () =>
      conceptId === undefined
        ? undefined
        : db.conceptNotes.get(`${topicSlug}:${conceptId}`),
    [topicSlug, conceptId],
  );

export const useConceptBookmarked = (
  topicSlug: string,
  conceptId: string | undefined,
): boolean =>
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
  const records = useLiveQuery(
    () => db.bookmarks.orderBy('createdAt').reverse().toArray(),
    [],
    [],
  );
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
