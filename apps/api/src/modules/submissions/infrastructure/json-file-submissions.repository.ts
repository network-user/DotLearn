import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import type { CreateSubmissionInput, SubmissionSource, SubmissionStatus } from '@dotlearn/contracts';

import { dataFile } from '../../../common/config/data-paths';
import { readJsonFile, writeJsonFile } from '../../../common/storage/json-file-store';
import { SubmissionEntity } from '../domain/submission.entity';
import type { FindManyFilter, SubmissionsRepository } from './submissions.repository';

interface SubmissionSnapshot {
  id: string;
  status: SubmissionStatus;
  source: SubmissionSource;
  createdAt: string;
  reviewedAt: string | null;
  reviewerNote: string | null;
  materializedSlug: string | null;
  payload: CreateSubmissionInput;
}

const FILE_NAME = 'submissions.json';

@Injectable()
export class JsonFileSubmissionsRepository implements SubmissionsRepository, OnModuleInit {
  private readonly logger = new Logger(JsonFileSubmissionsRepository.name);
  private readonly store = new Map<string, SubmissionEntity>();
  private writeQueue: Promise<void> = Promise.resolve();

  async onModuleInit(): Promise<void> {
    const path = dataFile(FILE_NAME);
    const snapshots = await readJsonFile<SubmissionSnapshot[]>(path, []);
    for (const snapshot of snapshots) {
      const entity = SubmissionEntity.restore({
        id: snapshot.id,
        status: snapshot.status,
        source: snapshot.source,
        createdAt: new Date(snapshot.createdAt),
        reviewedAt: snapshot.reviewedAt ? new Date(snapshot.reviewedAt) : null,
        reviewerNote: snapshot.reviewerNote ?? null,
        materializedSlug: snapshot.materializedSlug ?? null,
        payload: snapshot.payload,
      });
      this.store.set(entity.id, entity);
    }
    this.logger.log(
      { count: this.store.size, path },
      'submissions_repository_loaded',
    );
  }

  async save(submission: SubmissionEntity): Promise<void> {
    this.store.set(submission.id, submission);
    await this.persist();
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

  async findAll(): Promise<SubmissionEntity[]> {
    return this.findMany({});
  }

  private toSnapshot(entity: SubmissionEntity): SubmissionSnapshot {
    return {
      id: entity.id,
      status: entity.status,
      source: entity.source,
      createdAt: entity.createdAt.toISOString(),
      reviewedAt: entity.reviewedAt ? entity.reviewedAt.toISOString() : null,
      reviewerNote: entity.reviewerNote,
      materializedSlug: entity.materializedSlug,
      payload: entity.payload,
    };
  }

  private async persist(): Promise<void> {
    const snapshots = [...this.store.values()]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((entity) => this.toSnapshot(entity));
    this.writeQueue = this.writeQueue
      .catch(() => undefined)
      .then(() => writeJsonFile(dataFile(FILE_NAME), snapshots));
    await this.writeQueue;
  }
}
