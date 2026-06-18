import { createHash } from 'node:crypto';

import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { describe, expect, it } from 'vitest';

import type { AuthConfig } from './auth.config';
import { AuthService } from './auth.service';
import { LockoutService } from './domain/lockout.service';
import { SessionEpochService } from './domain/session-epoch.service';
import { StepUpService } from './domain/step-up.service';
import { TokenRevocationService } from './domain/token-revocation.service';
import { TotpReplayService } from './domain/totp-replay.service';

const buildConfig = (): AuthConfig => ({
  login: 'admin',
  passwordHash: '',
  totpSecret: '',
  backupCodeHashes: [],
  accessSecret: 'access-secret-for-tests',
  refreshSecret: 'refresh-secret-for-tests',
  accessTtlSec: 900,
  refreshTtlSec: 604800,
  stepUpTtlSec: 120,
  lockoutTtlSec: 300,
  loginWindowSec: 900,
  maxFailedAttempts: 5,
  cookieDomain: undefined,
  cookieSecure: false,
});

const buildService = (config: AuthConfig) => {
  const jwt = new JwtService({});
  const sessionEpoch = new SessionEpochService();
  const revocation = new TokenRevocationService();
  const service = new AuthService(
    config,
    jwt,
    new LockoutService(config),
    revocation,
    new StepUpService(config),
    sessionEpoch,
    new TotpReplayService(),
  );
  return { service, jwt, sessionEpoch, revocation };
};

const signRefresh = (jwt: JwtService, config: AuthConfig, jti: string, epoch = 0): string =>
  jwt.sign(
    { sub: config.login, scope: 'refresh', jti, epoch },
    {
      secret: config.refreshSecret,
      expiresIn: config.refreshTtlSec,
      algorithm: 'HS256',
    },
  );

describe('AuthService refresh-token rotation', () => {
  it('issues a fresh pair and revokes the presented jti on a normal refresh', async () => {
    const config = buildConfig();
    const { service, jwt, revocation } = buildService(config);
    const token = signRefresh(jwt, config, 'refresh-jti-1');

    const tokens = await service.refresh(token);

    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();
    expect(tokens.refreshToken).not.toBe(token);
    expect(revocation.isRevoked('refresh-jti-1')).toBe(true);
  });

  it('detects reuse of an already-rotated refresh token, bumps the session epoch, and rejects', async () => {
    const config = buildConfig();
    const { service, jwt, sessionEpoch } = buildService(config);
    const token = signRefresh(jwt, config, 'refresh-jti-2');

    await service.refresh(token);
    expect(sessionEpoch.current(config.login)).toBe(0);

    await expect(service.refresh(token)).rejects.toThrow('Refresh token reuse detected');
    expect(sessionEpoch.current(config.login)).toBe(1);
  });

  it('invalidates the whole session after reuse: tokens minted before the bump no longer verify', async () => {
    const config = buildConfig();
    const { service, jwt } = buildService(config);
    const stolen = signRefresh(jwt, config, 'refresh-jti-3');

    const rotated = await service.refresh(stolen);
    await expect(service.refresh(stolen)).rejects.toThrow('Refresh token reuse detected');

    await expect(service.refresh(rotated.refreshToken)).rejects.toThrow();
  });
});

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

describe('AuthService login -> access -> refresh -> logout (smoke)', () => {
  const buildAuthConfig = (): AuthConfig => ({
    ...buildConfig(),
    passwordHash: bcrypt.hashSync('correct-horse', 4),
    backupCodeHashes: [sha256('BACKUP01')],
  });

  it('logs in with a backup code and issues a verifiable, rotating token pair', async () => {
    const { service } = buildService(buildAuthConfig());

    const tokens = await service.login('admin', 'correct-horse', 'backup01');
    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();

    const claims = await service.verifyAccess(tokens.accessToken);
    expect(claims.sub).toBe('admin');
    expect(claims.scope).toBe('access');

    const refreshed = await service.refresh(tokens.refreshToken);
    expect(refreshed.accessToken).toBeTruthy();
    expect(refreshed.accessToken).not.toBe(tokens.accessToken);
  });

  it('logout revokes the access jti so the token stops verifying', async () => {
    const { service } = buildService(buildAuthConfig());

    const tokens = await service.login('admin', 'correct-horse', 'backup01');
    const claims = await service.verifyAccess(tokens.accessToken);

    await service.logout(undefined, claims.jti);

    await expect(service.verifyAccess(tokens.accessToken)).rejects.toThrow('Token revoked');
  });

  it('rejects a wrong password', async () => {
    const { service } = buildService(buildAuthConfig());
    await expect(service.login('admin', 'wrong', 'backup01')).rejects.toThrow(
      'Invalid credentials',
    );
  });
});
