import { Injectable } from '@nestjs/common';

import { SubmissionEntity } from '../domain/submission.entity';
import type { FindManyFilter, SubmissionsRepository } from './submissions.repository';

@Injectable()
export class InMemorySubmissionsRepository implements SubmissionsRepository {
  private readonly store = new Map<string, SubmissionEntity>();

  async save(submission: SubmissionEntity): Promise<void> {
    this.store.set(submission.id, submission);
  }

  async findById(id: string): Promise<SubmissionEntity | null> {
    return this.store.get(id) ?? null;
  }

  async findMany(filter: FindManyFilter): Promise<SubmissionEntity[]> {
    const all = [...this.store.values()].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
    if (!filter.status) return all;
    return all.filter((entity) => entity.status === filter.status);
  }
}
