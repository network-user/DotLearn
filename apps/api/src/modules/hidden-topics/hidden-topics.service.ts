import { ConflictException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

import type { HiddenTopic } from '@dotlearn/contracts';

import { HiddenTopicEntity } from './domain/hidden-topic.entity';
import {
  HIDDEN_TOPICS_REPOSITORY,
  type HiddenTopicsRepository,
} from './infrastructure/hidden-topics.repository';

@Injectable()
export class HiddenTopicsService {
  private readonly logger = new Logger(HiddenTopicsService.name);

  constructor(
    @Inject(HIDDEN_TOPICS_REPOSITORY)
    private readonly repository: HiddenTopicsRepository,
  ) {}

  async list(): Promise<HiddenTopic[]> {
    const entities = await this.repository.list();
    return entities.map((entity) => entity.toContract());
  }

  async listSlugs(): Promise<string[]> {
    const entities = await this.repository.list();
    return entities.map((entity) => entity.slug);
  }

  async hide(slug: string, reason?: string): Promise<HiddenTopic> {
    if (await this.repository.has(slug)) {
      throw new ConflictException(`Topic "${slug}" is already hidden`);
    }
    const entity = HiddenTopicEntity.create(slug, reason);
    await this.repository.add(entity);
    this.logger.log({ slug, reason }, 'topic_hidden');
    return entity.toContract();
  }

  async unhide(slug: string): Promise<void> {
    const removed = await this.repository.remove(slug);
    if (!removed) {
      throw new NotFoundException(`Topic "${slug}" is not hidden`);
    }
    this.logger.log({ slug }, 'topic_unhidden');
  }
}
