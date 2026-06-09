import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthConfig } from '../auth.config';
import { StepUpService } from './step-up.service';

const baseConfig: AuthConfig = {
  login: 'admin',
  passwordHash: 'hash',
  totpSecret: 'secret',
  backupCodeHashes: [],
  accessSecret: 'access',
  refreshSecret: 'refresh',
  accessTtlSec: 900,
  refreshTtlSec: 604800,
  stepUpTtlSec: 60,
  lockoutTtlSec: 300,
  loginWindowSec: 900,
  maxFailedAttempts: 5,
  cookieDomain: undefined,
  cookieSecure: false,
};

describe('StepUpService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports no flag for unknown subject/action', () => {
    const service = new StepUpService(baseConfig);
    expect(service.has('admin', 'submissions.review')).toBe(false);
    expect(service.consume('admin', 'submissions.review')).toBe(false);
  });

  it('grant() creates a flag that has() observes', () => {
    const service = new StepUpService(baseConfig);
    service.grant('admin', 'submissions.review');
    expect(service.has('admin', 'submissions.review')).toBe(true);
  });

  it('consume() one-shots the flag — second consume returns false', () => {
    const service = new StepUpService(baseConfig);
    service.grant('admin', 'submissions.review');
    expect(service.consume('admin', 'submissions.review')).toBe(true);
    expect(service.consume('admin', 'submissions.review')).toBe(false);
  });

  it('separates flags by action — granting one does not enable another', () => {
    const service = new StepUpService(baseConfig);
    service.grant('admin', 'submissions.review');
    expect(service.consume('admin', 'submissions.materialize')).toBe(false);
    expect(service.consume('admin', 'submissions.review')).toBe(true);
  });

  it('separates flags by subject — another admin cannot consume', () => {
    const service = new StepUpService(baseConfig);
    service.grant('admin', 'submissions.review');
    expect(service.consume('other', 'submissions.review')).toBe(false);
  });

  it('expired flag is not has() and cannot be consumed', () => {
    const service = new StepUpService(baseConfig);
    service.grant('admin', 'topics.hide');
    vi.advanceTimersByTime((baseConfig.stepUpTtlSec + 1) * 1000);
    expect(service.has('admin', 'topics.hide')).toBe(false);
    expect(service.consume('admin', 'topics.hide')).toBe(false);
  });

  it('grant() returns the absolute expiry timestamp', () => {
    const service = new StepUpService(baseConfig);
    const expectedExpiry = Date.now() + baseConfig.stepUpTtlSec * 1000;
    expect(service.grant('admin', 'topics.hide')).toBe(expectedExpiry);
  });
});
