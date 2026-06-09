import { Module } from '@nestjs/common';

import { ElasticsearchSearchService } from './elasticsearch-search.service';
import { InMemorySearchService } from './in-memory-search.service';
import { SEARCH_SERVICE } from './search.service';

const isEnabled = (raw: string | undefined): boolean =>
  raw !== undefined && ['1', 'true', 'yes', 'on'].includes(raw.toLowerCase());

@Module({
  providers: [
    {
      provide: SEARCH_SERVICE,
      useClass: isEnabled(process.env.ES_ENABLED)
        ? ElasticsearchSearchService
        : InMemorySearchService,
    },
  ],
  exports: [SEARCH_SERVICE],
})
export class SearchModule {}
