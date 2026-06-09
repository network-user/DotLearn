import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthConfig } from '../auth.config';
import { LockoutService } from './lockout.service';

const baseConfig: AuthConfig = {
  login: 'admin',
  passwordHash: 'hash',
  totpSecret: 'secret',
  backupCodeHashes: [],
  accessSecret: 'access',
  refreshSecret: 'refresh',
  accessTtlSec: 900,
  refreshTtlSec: 604800,
  stepUpTtlSec: 120,
  lockoutTtlSec: 300,
  loginWindowSec: 900,
  maxFailedAttempts: 3,
  cookieDomain: undefined,
  cookieSecure: false,
};

describe('LockoutService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports no lockout for an unknown key', () => {
    const service = new LockoutService(baseConfig);
    expect(service.isLocked('admin')).toEqual({ locked: false, secondsRemaining: 0 });
  });

  it('locks after maxFailedAttempts and reports remaining time', () => {
    const service = new LockoutService(baseConfig);
    for (let attempt = 0; attempt < baseConfig.maxFailedAttempts; attempt += 1) {
      service.registerFailure('admin');
    }
    const result = service.isLocked('admin');
    expect(result.locked).toBe(true);
    expect(result.secondsRemaining).toBeGreaterThan(0);
    expect(result.secondsRemaining).toBeLessThanOrEqual(baseConfig.lockoutTtlSec);
  });

  it('does not lock if attempts stay below threshold', () => {
    const service = new LockoutService(baseConfig);
    service.registerFailure('admin');
    service.registerFailure('admin');
    expect(service.isLocked('admin').locked).toBe(false);
  });

  it('expires lockout after TTL passes', () => {
    const service = new LockoutService(baseConfig);
    for (let attempt = 0; attempt < baseConfig.maxFailedAttempts; attempt += 1) {
      service.registerFailure('admin');
    }
    expect(service.isLocked('admin').locked).toBe(true);
    vi.advanceTimersByTime(baseConfig.lockoutTtlSec * 1000 + 1000);
    expect(service.isLocked('admin').locked).toBe(false);
  });

  it('resets the failure window when it expires before a new failure', () => {
    const service = new LockoutService(baseConfig);
    service.registerFailure('admin');
    service.registerFailure('admin');
    vi.advanceTimersByTime((baseConfig.loginWindowSec + 1) * 1000);
    service.registerFailure('admin');
    expect(service.isLocked('admin').locked).toBe(false);
  });

  it('clear() removes the failure record', () => {
    const service = new LockoutService(baseConfig);
    for (let attempt = 0; attempt < baseConfig.maxFailedAttempts; attempt += 1) {
      service.registerFailure('admin');
    }
    service.clear('admin');
    expect(service.isLocked('admin')).toEqual({ locked: false, secondsRemaining: 0 });
  });

  it('tracks lockouts per key independently', () => {
    const service = new LockoutService(baseConfig);
    for (let attempt = 0; attempt < baseConfig.maxFailedAttempts; attempt += 1) {
      service.registerFailure('admin');
    }
    expect(service.isLocked('admin').locked).toBe(true);
    expect(service.isLocked('other').locked).toBe(false);
  });
});
