import type { HiddenTopicEntity } from '../domain/hidden-topic.entity';

export const HIDDEN_TOPICS_REPOSITORY = Symbol('HiddenTopicsRepository');

export interface HiddenTopicsRepository {
  list(): Promise<HiddenTopicEntity[]>;
  has(slug: string): Promise<boolean>;
  add(entity: HiddenTopicEntity): Promise<void>;
  remove(slug: string): Promise<boolean>;
}
