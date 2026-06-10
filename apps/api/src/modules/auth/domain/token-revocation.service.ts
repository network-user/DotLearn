import { Injectable, type OnModuleInit } from '@nestjs/common';

import { PersistentMap } from '../../../common/storage/persistent-map';

@Injectable()
export class TokenRevocationService implements OnModuleInit {
  private readonly revoked = new PersistentMap<number>('revoked-tokens.json');

  async onModuleInit(): Promise<void> {
    await this.revoked.load();
    this.gc();
  }

  revoke(jti: string, expiresAtUnixSeconds: number): void {
    this.revoked.set(jti, expiresAtUnixSeconds * 1000);
    this.gc();
  }

  isRevoked(jti: string): boolean {
    const expiresAtMs = this.revoked.get(jti);
    if (!expiresAtMs) return false;
    if (expiresAtMs < Date.now()) {
      this.revoked.delete(jti);
      return false;
    }
    return true;
  }

  private gc(): void {
    const now = Date.now();
    if (this.revoked.size < 256) return;
    for (const [jti, expiresAtMs] of this.revoked.entries()) {
      if (expiresAtMs < now) {
        this.revoked.delete(jti);
      }
    }
  }
}
