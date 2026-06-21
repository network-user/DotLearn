import type { ExecutionContext } from '@nestjs/common';
import { ForbiddenException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthClaims, AuthService } from '../auth.service';
import type { AuthenticatedRequest } from './admin-auth.guard';
import { StepUpGuard } from './step-up.guard';

const claims: AuthClaims = {
  sub: 'admin',
  jti: 'jti-1',
  scope: 'access',
  epoch: 0,
  exp: 0,
  iat: 0,
};

const contextFor = (admin: AuthClaims | undefined): ExecutionContext => {
  const request: Partial<AuthenticatedRequest> = admin ? { admin } : {};
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({
      getRequest: <T>() => request as T,
    }),
  } as unknown as ExecutionContext;
};

const buildGuard = (
  action: string | undefined,
): { guard: StepUpGuard; consumeStepUp: ReturnType<typeof vi.fn> } => {
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(action),
  } as unknown as Reflector;
  const consumeStepUp = vi.fn();
  const guard = new StepUpGuard(reflector, {
    consumeStepUp,
  } as unknown as AuthService);
  return { guard, consumeStepUp };
};

describe('StepUpGuard', () => {
  let consumeStepUp: ReturnType<typeof vi.fn>;
  let guard: StepUpGuard;

  describe('when no step-up action is required', () => {
    beforeEach(() => {
      ({ guard, consumeStepUp } = buildGuard(undefined));
    });

    it('allows the request without consulting auth', () => {
      expect(guard.canActivate(contextFor(claims))).toBe(true);
      expect(consumeStepUp).not.toHaveBeenCalled();
    });
  });

  describe('when a step-up action is required', () => {
    beforeEach(() => {
      ({ guard, consumeStepUp } = buildGuard('submissions.review'));
    });

    it('allows the request when the step-up grant is consumed', () => {
      consumeStepUp.mockReturnValue(true);
      expect(guard.canActivate(contextFor(claims))).toBe(true);
      expect(consumeStepUp).toHaveBeenCalledWith('admin', 'submissions.review');
    });

    it('throws ForbiddenException when authentication did not run first', () => {
      expect(() => guard.canActivate(contextFor(undefined))).toThrow(ForbiddenException);
      expect(consumeStepUp).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when no step-up grant is available', () => {
      consumeStepUp.mockReturnValue(false);
      expect(() => guard.canActivate(contextFor(claims))).toThrow(ForbiddenException);
      expect(consumeStepUp).toHaveBeenCalledWith('admin', 'submissions.review');
    });
  });
});
