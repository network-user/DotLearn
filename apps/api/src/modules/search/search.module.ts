import { Module } from '@nestjs/common';

import { InMemorySearchService } from './in-memory-search.service';
import { SEARCH_SERVICE } from './search.service';

@Module({
  providers: [
    {
      provide: SEARCH_SERVICE,
      useClass: InMemorySearchService,
    },
  ],
  exports: [SEARCH_SERVICE],
})
export class SearchModule {}
