import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';

import {
  SUBMISSIONS_REPOSITORY,
  type SubmissionsRepository,
} from '../submissions/infrastructure/submissions.repository';
import { SEARCH_SERVICE, type SearchDocument, type SearchService } from './search.service';

const toDocument = (snapshot: {
  id: string;
  payload: { title: string; outline: string; tags: string[] };
}): SearchDocument => ({
  id: snapshot.id,
  title: snapshot.payload.title,
  outline: snapshot.payload.outline,
  tags: snapshot.payload.tags,
});

@Injectable()
export class SubmissionsSearchIndexer implements OnModuleInit {
  private readonly logger = new Logger(SubmissionsSearchIndexer.name);

  constructor(
    @Inject(SUBMISSIONS_REPOSITORY)
    private readonly submissions: SubmissionsRepository,
    @Inject(SEARCH_SERVICE)
    private readonly search: SearchService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rebuild();
  }

  async rebuild(): Promise<void> {
    const all = await this.submissions.findAll();
    const documents = all.map((entity) =>
      toDocument({
        id: entity.id,
        payload: {
          title: entity.payload.title,
          outline: entity.payload.outline,
          tags: entity.payload.tags,
        },
      }),
    );
    await this.search.reindexAll(documents);
    this.logger.log({ count: documents.length }, 'search_index_built');
  }

  async indexOne(id: string): Promise<void> {
    const entity = await this.submissions.findById(id);
    if (!entity) {
      await this.search.remove(id);
      return;
    }
    await this.search.upsert(
      toDocument({
        id: entity.id,
        payload: {
          title: entity.payload.title,
          outline: entity.payload.outline,
          tags: entity.payload.tags,
        },
      }),
    );
  }
}
