import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { dataFile } from '../../../common/config/data-paths';
import { readJsonFile, writeJsonFile } from '../../../common/storage/json-file-store';
import { HiddenTopicEntity } from '../domain/hidden-topic.entity';
import type { HiddenTopicsRepository } from './hidden-topics.repository';

interface HiddenTopicSnapshot {
  slug: string;
  hiddenAt: string;
  reason: string | null;
}

const FILE_NAME = 'hidden-topics.json';

@Injectable()
export class JsonFileHiddenTopicsRepository implements HiddenTopicsRepository, OnModuleInit {
  private readonly logger = new Logger(JsonFileHiddenTopicsRepository.name);
  private readonly store = new Map<string, HiddenTopicEntity>();
  private writeQueue: Promise<void> = Promise.resolve();

  async onModuleInit(): Promise<void> {
    const path = dataFile(FILE_NAME);
    const snapshots = await readJsonFile<HiddenTopicSnapshot[]>(path, []);
    for (const snapshot of snapshots) {
      const entity = HiddenTopicEntity.restore({
        slug: snapshot.slug,
        hiddenAt: new Date(snapshot.hiddenAt),
        reason: snapshot.reason,
      });
      this.store.set(entity.slug, entity);
    }
    this.logger.log({ count: this.store.size, path }, 'hidden_topics_repository_loaded');
  }

  async list(): Promise<HiddenTopicEntity[]> {
    return [...this.store.values()].sort((a, b) => a.slug.localeCompare(b.slug));
  }

  async has(slug: string): Promise<boolean> {
    return this.store.has(slug);
  }

  async add(entity: HiddenTopicEntity): Promise<void> {
    this.store.set(entity.slug, entity);
    await this.persist();
  }

  async remove(slug: string): Promise<boolean> {
    const existed = this.store.delete(slug);
    if (existed) {
      await this.persist();
    }
    return existed;
  }

  private async persist(): Promise<void> {
    const snapshots = [...this.store.values()].map((entity) => ({
      slug: entity.slug,
      hiddenAt: entity.hiddenAt.toISOString(),
      reason: entity.reason,
    }));
    this.writeQueue = this.writeQueue
      .catch(() => undefined)
      .then(() => writeJsonFile(dataFile(FILE_NAME), snapshots));
    await this.writeQueue;
  }
}
