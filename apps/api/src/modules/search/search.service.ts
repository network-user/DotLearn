export interface SearchDocument {
  id: string;
  title: string;
  outline: string;
  tags: string[];
}

export interface SearchHit {
  id: string;
  score: number;
}

export interface SearchSuggestion {
  id: string;
  title: string;
  score: number;
}

export const SEARCH_SERVICE = Symbol('SearchService');

export interface SearchService {
  reindexAll(documents: SearchDocument[]): Promise<void>;
  upsert(document: SearchDocument): Promise<void>;
  remove(id: string): Promise<void>;
  search(query: string, limit?: number): Promise<SearchHit[]>;
  suggest(query: string, limit?: number): Promise<SearchSuggestion[]>;
}
