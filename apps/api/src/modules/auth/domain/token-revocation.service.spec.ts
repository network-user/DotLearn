import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TokenRevocationService } from './token-revocation.service';

describe('TokenRevocationService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports an unknown jti as not revoked', () => {
    const service = new TokenRevocationService();
    expect(service.isRevoked('jti-unknown')).toBe(false);
  });

  it('revoke() marks a jti as revoked while not expired', () => {
    const service = new TokenRevocationService();
    const expiresAt = Math.floor(Date.now() / 1000) + 60;
    service.revoke('jti-1', expiresAt);
    expect(service.isRevoked('jti-1')).toBe(true);
  });

  it('treats jti as not revoked once its expiry passes', () => {
    const service = new TokenRevocationService();
    const expiresAt = Math.floor(Date.now() / 1000) + 30;
    service.revoke('jti-2', expiresAt);
    vi.advanceTimersByTime(60_000);
    expect(service.isRevoked('jti-2')).toBe(false);
  });

  it('tracks multiple jtis independently', () => {
    const service = new TokenRevocationService();
    const now = Math.floor(Date.now() / 1000);
    service.revoke('a', now + 60);
    service.revoke('b', now + 120);
    expect(service.isRevoked('a')).toBe(true);
    expect(service.isRevoked('b')).toBe(true);
    expect(service.isRevoked('c')).toBe(false);
  });
});
