import { Injectable } from '@nestjs/common';

import { normalizeQuery, scoreDocument, tokenMatchScore, tokenize } from './domain/fuzzy';
import type {
  SearchDocument,
  SearchHit,
  SearchService,
  SearchSuggestion,
} from './search.service';

const DEFAULT_SEARCH_LIMIT = 20;
const DEFAULT_SUGGEST_LIMIT = 8;
const SUGGEST_MIN_QUERY_LENGTH = 2;

@Injectable()
export class InMemorySearchService implements SearchService {
  private readonly documents = new Map<string, SearchDocument>();

  async reindexAll(documents: SearchDocument[]): Promise<void> {
    this.documents.clear();
    for (const document of documents) {
      this.documents.set(document.id, document);
    }
  }

  async upsert(document: SearchDocument): Promise<void> {
    this.documents.set(document.id, document);
  }

  async remove(id: string): Promise<void> {
    this.documents.delete(id);
  }

  async search(query: string, limit = DEFAULT_SEARCH_LIMIT): Promise<SearchHit[]> {
    const normalized = normalizeQuery(query);
    if (!normalized) return [];
    const scored: SearchHit[] = [];
    for (const document of this.documents.values()) {
      const score = scoreDocument(query, {
        title: document.title,
        outline: document.outline,
        tags: document.tags,
      });
      if (score > 0) {
        scored.push({ id: document.id, score });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  async suggest(query: string, limit = DEFAULT_SUGGEST_LIMIT): Promise<SearchSuggestion[]> {
    const normalized = normalizeQuery(query);
    if (normalized.length < SUGGEST_MIN_QUERY_LENGTH) return [];
    const queryTokens = tokenize(normalized);
    if (queryTokens.length === 0) return [];
    const lastToken = queryTokens[queryTokens.length - 1] ?? '';
    const suggestions: SearchSuggestion[] = [];
    for (const document of this.documents.values()) {
      const titleTokens = tokenize(document.title);
      let best = 0;
      for (const titleToken of titleTokens) {
        const score = tokenMatchScore(lastToken, titleToken);
        if (score > best) best = score;
      }
      if (best > 0.5) {
        suggestions.push({ id: document.id, title: document.title, score: best });
      }
    }
    suggestions.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
    return suggestions.slice(0, limit);
  }
}
