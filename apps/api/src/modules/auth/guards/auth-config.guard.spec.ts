import type { ExecutionContext } from '@nestjs/common';
import { ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { AuthConfigGuard } from './auth-config.guard';

const context = {} as ExecutionContext;

describe('AuthConfigGuard', () => {
  it('allows the request when auth config is valid', () => {
    const guard = new AuthConfigGuard(null);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws ServiceUnavailableException without leaking the reason when config is broken', () => {
    const guard = new AuthConfigGuard('Auth not configured. Set: ADMIN_JWT_SECRET');
    expect(() => guard.canActivate(context)).toThrow(ServiceUnavailableException);
    try {
      guard.canActivate(context);
    } catch (error) {
      expect((error as ServiceUnavailableException).message).not.toMatch(/ADMIN_JWT_SECRET/);
    }
  });
});
