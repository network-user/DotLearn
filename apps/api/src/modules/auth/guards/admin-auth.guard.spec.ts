import type { ExecutionContext } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthClaims, AuthService } from '../auth.service';
import { AdminAuthGuard, type AuthenticatedRequest } from './admin-auth.guard';

const claims: AuthClaims = {
  sub: 'admin',
  jti: 'jti-1',
  scope: 'access',
  epoch: 0,
  exp: 0,
  iat: 0,
};

const contextFor = (request: Partial<AuthenticatedRequest>): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: <T>() => request as T,
    }),
  }) as unknown as ExecutionContext;

describe('AdminAuthGuard', () => {
  let verifyAccess: ReturnType<typeof vi.fn>;
  let guard: AdminAuthGuard;

  beforeEach(() => {
    verifyAccess = vi.fn();
    guard = new AdminAuthGuard({ verifyAccess } as unknown as AuthService);
  });

  it('allows the request and attaches claims for a valid Bearer token', async () => {
    verifyAccess.mockResolvedValue(claims);
    const request: Partial<AuthenticatedRequest> = {
      headers: { authorization: 'Bearer good-token' },
    };
    await expect(guard.canActivate(contextFor(request))).resolves.toBe(true);
    expect(verifyAccess).toHaveBeenCalledWith('good-token');
    expect(request.admin).toBe(claims);
  });

  it('throws UnauthorizedException when the Authorization header is missing', async () => {
    const request: Partial<AuthenticatedRequest> = { headers: {} };
    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(verifyAccess).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException for a non-Bearer scheme', async () => {
    const request: Partial<AuthenticatedRequest> = {
      headers: { authorization: 'Basic abc' },
    };
    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(verifyAccess).not.toHaveBeenCalled();
  });

  it('propagates the rejection when token verification fails', async () => {
    verifyAccess.mockRejectedValue(new UnauthorizedException('Token revoked'));
    const request: Partial<AuthenticatedRequest> = {
      headers: { authorization: 'Bearer revoked' },
    };
    await expect(guard.canActivate(contextFor(request))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
