import { Module } from '@nestjs/common';

import { InMemorySearchService } from './in-memory-search.service';
import { SEARCH_SERVICE, type SearchService } from './search.service';

const isEnabled = (raw: string | undefined): boolean =>
  raw !== undefined && ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());

@Module({
  providers: [
    {
      provide: SEARCH_SERVICE,
      useFactory: async (): Promise<SearchService> => {
        if (isEnabled(process.env.ES_ENABLED)) {
          const { ElasticsearchSearchService } = await import('./elasticsearch-search.service');
          return new ElasticsearchSearchService();
        }
        return new InMemorySearchService();
      },
    },
  ],
  exports: [SEARCH_SERVICE],
})
export class SearchModule {}
