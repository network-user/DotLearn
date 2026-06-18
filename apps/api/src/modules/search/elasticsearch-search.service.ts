import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';

import type { SearchDocument, SearchHit, SearchService, SearchSuggestion } from './search.service';

const DEFAULT_SEARCH_LIMIT = 20;
const DEFAULT_SUGGEST_LIMIT = 8;

interface ElasticsearchSettings {
  node: string;
  username: string | undefined;
  password: string | undefined;
  apiKey: string | undefined;
  indexName: string;
}

const loadSettings = (): ElasticsearchSettings => ({
  node: process.env.ES_NODE ?? 'http://localhost:9200',
  username: process.env.ES_USERNAME || undefined,
  password: process.env.ES_PASSWORD || undefined,
  apiKey: process.env.ES_API_KEY || undefined,
  indexName: process.env.ES_SUBMISSIONS_INDEX ?? 'dotlearn-submissions',
});

@Injectable()
export class ElasticsearchSearchService implements SearchService, OnModuleInit {
  private readonly logger = new Logger(ElasticsearchSearchService.name);
  private readonly settings = loadSettings();
  private readonly client: Client;

  constructor() {
    this.client = new Client({
      node: this.settings.node,
      ...(this.settings.apiKey
        ? { auth: { apiKey: this.settings.apiKey } }
        : this.settings.username && this.settings.password
          ? {
              auth: { username: this.settings.username, password: this.settings.password },
            }
          : {}),
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureIndex();
    } catch (error) {
      this.logger.warn({ err: error }, 'elasticsearch_init_failed');
    }
  }

  async reindexAll(documents: SearchDocument[]): Promise<void> {
    await this.ensureIndex();
    await this.client.indices.refresh({ index: this.settings.indexName }).catch(() => undefined);
    if (documents.length === 0) {
      await this.client
        .deleteByQuery({
          index: this.settings.indexName,
          query: { match_all: {} },
          refresh: true,
        })
        .catch(() => undefined);
      return;
    }
    const operations = documents.flatMap((doc) => [
      { index: { _index: this.settings.indexName, _id: doc.id } },
      this.toBody(doc),
    ]);
    await this.client.bulk({ operations, refresh: true });
  }

  async upsert(document: SearchDocument): Promise<void> {
    await this.ensureIndex();
    await this.client.index({
      index: this.settings.indexName,
      id: document.id,
      document: this.toBody(document),
      refresh: true,
    });
  }

  async remove(id: string): Promise<void> {
    try {
      await this.client.delete({ index: this.settings.indexName, id, refresh: true });
    } catch (error) {
      this.logger.debug({ err: error, id }, 'elasticsearch_remove_failed');
    }
  }

  async search(query: string, limit = DEFAULT_SEARCH_LIMIT): Promise<SearchHit[]> {
    if (!query.trim()) return [];
    const response = await this.client.search<Record<string, unknown>>({
      index: this.settings.indexName,
      size: limit,
      query: {
        multi_match: {
          query,
          fields: ['title^4', 'tags^3', 'outline'],
          fuzziness: 'AUTO',
          prefix_length: 1,
          operator: 'or',
        },
      },
    });
    return response.hits.hits.map((hit) => ({
      id: hit._id ?? '',
      score: hit._score ?? 0,
    }));
  }

  async suggest(query: string, limit = DEFAULT_SUGGEST_LIMIT): Promise<SearchSuggestion[]> {
    if (!query.trim()) return [];
    const response = await this.client.search<Record<string, unknown>>({
      index: this.settings.indexName,
      size: 0,
      suggest: {
        title_suggest: {
          prefix: query,
          completion: {
            field: 'titleSuggest',
            size: limit,
            fuzzy: { fuzziness: 1 },
            skip_duplicates: true,
          },
        },
      },
    });
    const buckets = response.suggest?.title_suggest ?? [];
    const suggestions: SearchSuggestion[] = [];
    for (const bucket of buckets) {
      const options = (bucket as { options?: unknown }).options;
      const list = Array.isArray(options) ? options : options ? [options] : [];
      for (const option of list) {
        const obj = option as { _id?: string; text?: string; _score?: number };
        suggestions.push({
          id: String(obj._id ?? ''),
          title: String(obj.text ?? ''),
          score: Number(obj._score ?? 0),
        });
      }
    }
    return suggestions;
  }

  private toBody(document: SearchDocument): Record<string, unknown> {
    return {
      title: document.title,
      outline: document.outline,
      tags: document.tags,
      titleSuggest: {
        input: [document.title, ...document.tags],
      },
    };
  }

  private async ensureIndex(): Promise<void> {
    const exists = await this.client.indices.exists({ index: this.settings.indexName });
    if (exists) return;
    await this.client.indices.create({
      index: this.settings.indexName,
      mappings: {
        properties: {
          title: { type: 'text', analyzer: 'standard' },
          outline: { type: 'text', analyzer: 'standard' },
          tags: { type: 'keyword' },
          titleSuggest: { type: 'completion' },
        },
      },
    });
    this.logger.log({ index: this.settings.indexName }, 'elasticsearch_index_created');
  }
}
