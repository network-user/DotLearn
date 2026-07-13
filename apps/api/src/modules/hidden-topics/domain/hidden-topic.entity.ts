import type { HiddenTopic, HiddenTopicPublic } from '@dotlearn/contracts';

export class HiddenTopicEntity {
  private constructor(
    public readonly slug: string,
    public readonly hiddenAt: Date,
    public readonly reason: string | null,
  ) {}

  static create(slug: string, reason?: string): HiddenTopicEntity {
    return new HiddenTopicEntity(slug, new Date(), reason ?? null);
  }

  static restore(snapshot: {
    slug: string;
    hiddenAt: Date;
    reason: string | null;
  }): HiddenTopicEntity {
    return new HiddenTopicEntity(snapshot.slug, snapshot.hiddenAt, snapshot.reason);
  }

  toPublicContract(): HiddenTopicPublic {
    return {
      slug: this.slug,
      hiddenAt: this.hiddenAt.toISOString(),
    };
  }

  toAdminContract(): HiddenTopic {
    return {
      slug: this.slug,
      hiddenAt: this.hiddenAt.toISOString(),
      ...(this.reason ? { reason: this.reason } : {}),
    };
  }
}
