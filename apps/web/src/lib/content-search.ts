import type { SearchEntry } from 'virtual:search-index';

export type { SearchEntry };

export type SearchLanguage = 'en' | 'ru';

export const MIN_SEARCH_QUERY_LENGTH = 2;
export const SNIPPET_RADIUS = 60;

export const searchLanguageOf = (resolvedLanguage: string | undefined): SearchLanguage =>
  resolvedLanguage === 'en' ? 'en' : 'ru';

const searchEntriesCache = new Map<SearchLanguage, Promise<SearchEntry[]>>();

export const loadSearchEntries = async (language: SearchLanguage): Promise<SearchEntry[]> => {
  const cached = searchEntriesCache.get(language);
  if (cached) return cached;

  const promise = (async () => {
    const module =
      language === 'en'
        ? await import('virtual:search-index/en')
        : await import('virtual:search-index/ru');
    try {
      return JSON.parse(module.default) as SearchEntry[];
    } catch {
      return [];
    }
  })();

  searchEntriesCache.set(language, promise);
  promise.catch(() => {
    searchEntriesCache.delete(language);
  });
  return promise;
};

export interface SearchSnippet {
  before: string;
  hit: string;
  after: string;
}

export const buildSnippet = (text: string, query: string, matchIndex: number): SearchSnippet => {
  const start = Math.max(0, matchIndex - SNIPPET_RADIUS);
  const end = Math.min(text.length, matchIndex + query.length + SNIPPET_RADIUS);
  const leadingEllipsis = start > 0 ? '…' : '';
  const trailingEllipsis = end < text.length ? '…' : '';
  return {
    before: `${leadingEllipsis}${text.slice(start, matchIndex)}`,
    hit: text.slice(matchIndex, matchIndex + query.length),
    after: `${text.slice(matchIndex + query.length, end)}${trailingEllipsis}`,
  };
};

export interface ContentMatch extends SearchSnippet {
  key: string;
  slug: string;
  conceptId: string;
  conceptTitle: string;
  topicTitle: string;
}

export const searchContentEntries = (
  entries: readonly SearchEntry[],
  query: string,
  limit: number,
): ContentMatch[] => {
  const q = query.trim().toLowerCase();
  if (q.length < MIN_SEARCH_QUERY_LENGTH) return [];

  type Ranked = ContentMatch & { titleHit: boolean; matchIndex: number };
  const ranked: Ranked[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    const titleIndex = entry.conceptTitle.toLowerCase().indexOf(q);
    const bodyIndex = entry.text.toLowerCase().indexOf(q);
    if (titleIndex < 0 && bodyIndex < 0) continue;

    const dedupeKey = `${entry.slug}:${entry.conceptId}:${entry.type}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const matchIndex = bodyIndex >= 0 ? bodyIndex : 0;
    const snippet =
      bodyIndex >= 0
        ? buildSnippet(entry.text, q, bodyIndex)
        : {
            before: '',
            hit: '',
            after:
              entry.text.slice(0, SNIPPET_RADIUS * 2) +
              (entry.text.length > SNIPPET_RADIUS * 2 ? '…' : ''),
          };

    ranked.push({
      key: `${entry.type}-${entry.slug}-${entry.conceptId}`,
      slug: entry.slug,
      conceptId: entry.conceptId,
      conceptTitle: entry.conceptTitle,
      topicTitle: entry.topicTitle,
      before: snippet.before,
      hit: snippet.hit,
      after: snippet.after,
      titleHit: titleIndex >= 0,
      matchIndex,
    });
  }

  ranked.sort((left, right) => {
    if (left.titleHit !== right.titleHit) return left.titleHit ? -1 : 1;
    return left.matchIndex - right.matchIndex;
  });

  return ranked.slice(0, limit);
};

export interface InterviewSearchable {
  title: string;
  categoryLabel: string;
}

export const searchInterviewEntries = <T extends InterviewSearchable>(
  items: readonly T[],
  query: string,
  limit: number,
): T[] => {
  const q = query.trim().toLowerCase();
  if (q.length < MIN_SEARCH_QUERY_LENGTH) return [];
  const out: T[] = [];
  for (const item of items) {
    if (item.title.toLowerCase().includes(q) || item.categoryLabel.toLowerCase().includes(q)) {
      out.push(item);
      if (out.length >= limit) break;
    }
  }
  return out;
};
