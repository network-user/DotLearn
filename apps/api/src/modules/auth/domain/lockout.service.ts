import { Inject, Injectable } from '@nestjs/common';

import { AUTH_CONFIG, type AuthConfig } from '../auth.config';

interface Attempt {
  failures: number;
  windowEndsAt: number;
  lockedUntil: number;
}

@Injectable()
export class LockoutService {
  private readonly state = new Map<string, Attempt>();

  constructor(@Inject(AUTH_CONFIG) private readonly config: AuthConfig) {}

  isLocked(key: string): { locked: boolean; secondsRemaining: number } {
    const entry = this.state.get(key);
    if (!entry) return { locked: false, secondsRemaining: 0 };
    const now = Date.now();
    if (entry.lockedUntil > now) {
      return { locked: true, secondsRemaining: Math.ceil((entry.lockedUntil - now) / 1000) };
    }
    return { locked: false, secondsRemaining: 0 };
  }

  registerFailure(key: string): void {
    const now = Date.now();
    const existing = this.state.get(key);
    if (!existing || existing.windowEndsAt < now) {
      this.state.set(key, {
        failures: 1,
        windowEndsAt: now + this.config.loginWindowSec * 1000,
        lockedUntil: 0,
      });
      return;
    }
    existing.failures += 1;
    if (existing.failures >= this.config.maxFailedAttempts) {
      existing.lockedUntil = now + this.config.lockoutTtlSec * 1000;
    }
    this.state.set(key, existing);
  }

  clear(key: string): void {
    this.state.delete(key);
  }
}
