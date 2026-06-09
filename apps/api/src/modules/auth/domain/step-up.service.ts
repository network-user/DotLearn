import { Inject, Injectable } from '@nestjs/common';

import { AUTH_CONFIG, type AuthConfig } from '../auth.config';

@Injectable()
export class StepUpService {
  private readonly flags = new Map<string, number>();

  constructor(@Inject(AUTH_CONFIG) private readonly config: AuthConfig) {}

  private key(subject: string, action: string): string {
    return `${subject}::${action}`;
  }

  grant(subject: string, action: string): number {
    const expiresAt = Date.now() + this.config.stepUpTtlSec * 1000;
    this.flags.set(this.key(subject, action), expiresAt);
    return expiresAt;
  }

  consume(subject: string, action: string): boolean {
    const key = this.key(subject, action);
    const expiresAt = this.flags.get(key);
    if (!expiresAt) return false;
    this.flags.delete(key);
    if (expiresAt < Date.now()) return false;
    return true;
  }

  has(subject: string, action: string): boolean {
    const expiresAt = this.flags.get(this.key(subject, action));
    if (!expiresAt) return false;
    if (expiresAt < Date.now()) {
      this.flags.delete(this.key(subject, action));
      return false;
    }
    return true;
  }
}
