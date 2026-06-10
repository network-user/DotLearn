import { Injectable, type OnModuleInit } from '@nestjs/common';

import { PersistentMap } from '../../../common/storage/persistent-map';

@Injectable()
export class TotpReplayService implements OnModuleInit {
  private readonly lastTimeSteps = new PersistentMap<number>('totp-timesteps.json');
  private readonly consumedBackupCodes = new PersistentMap<number>('backup-codes-consumed.json');

  async onModuleInit(): Promise<void> {
    await this.lastTimeSteps.load();
    await this.consumedBackupCodes.load();
  }

  lastTimeStep(subject: string): number | undefined {
    return this.lastTimeSteps.get(subject);
  }

  recordTimeStep(subject: string, timeStep: number): void {
    this.lastTimeSteps.set(subject, timeStep);
  }

  isBackupCodeConsumed(hash: string): boolean {
    return this.consumedBackupCodes.has(hash);
  }

  consumeBackupCode(hash: string, consumedAtUnixMs: number): void {
    this.consumedBackupCodes.set(hash, consumedAtUnixMs);
  }
}
