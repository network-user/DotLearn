import { Injectable, type OnModuleInit } from '@nestjs/common';

import { PersistentMap } from '../../../common/storage/persistent-map';

@Injectable()
export class SessionEpochService implements OnModuleInit {
  private readonly epochs = new PersistentMap<number>('session-epochs.json');

  async onModuleInit(): Promise<void> {
    await this.epochs.load();
  }

  current(subject: string): number {
    return this.epochs.get(subject) ?? 0;
  }

  bump(subject: string): number {
    const next = this.current(subject) + 1;
    this.epochs.set(subject, next);
    return next;
  }
}
