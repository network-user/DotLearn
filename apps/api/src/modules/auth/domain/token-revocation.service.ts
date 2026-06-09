import { Injectable } from '@nestjs/common';

@Injectable()
export class TokenRevocationService {
  private readonly revoked = new Map<string, number>();

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
    for (const [jti, expiresAtMs] of this.revoked) {
      if (expiresAtMs < now) {
        this.revoked.delete(jti);
      }
    }
  }
}
