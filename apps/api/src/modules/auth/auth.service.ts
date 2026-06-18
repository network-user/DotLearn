import { createHash, randomUUID } from 'node:crypto';

import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { verifySync } from 'otplib';

import { AUTH_CONFIG, type AuthConfig } from './auth.config';
import { LockoutService } from './domain/lockout.service';
import { SessionEpochService } from './domain/session-epoch.service';
import { StepUpService } from './domain/step-up.service';
import { TokenRevocationService } from './domain/token-revocation.service';
import { TotpReplayService } from './domain/totp-replay.service';

export interface AuthTokens {
  accessToken: string;
  accessExpiresAt: number;
  refreshToken: string;
  refreshExpiresAt: number;
}

export interface AuthClaims {
  sub: string;
  jti: string;
  scope: 'access' | 'refresh';
  epoch: number;
  exp: number;
  iat: number;
}

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

const verifyTotp = (
  code: string,
  secret: string,
  backupHashes: string[],
  afterTimeStep: number | undefined,
): { ok: true; usedBackupCodeHash?: string; timeStep?: number } | { ok: false } => {
  const trimmed = code.trim();
  try {
    const result = verifySync({
      token: trimmed,
      secret,
      epochTolerance: [1, 0],
      ...(afterTimeStep !== undefined ? { afterTimeStep } : {}),
    });
    if (result.valid) {
      return 'timeStep' in result ? { ok: true, timeStep: result.timeStep } : { ok: true };
    }
  } catch {
    /* fall through to backup codes */
  }
  const candidate = sha256(trimmed.toUpperCase());
  if (backupHashes.includes(candidate)) {
    return { ok: true, usedBackupCodeHash: candidate };
  }
  return { ok: false };
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
    private readonly jwt: JwtService,
    private readonly lockout: LockoutService,
    private readonly revocation: TokenRevocationService,
    private readonly stepUp: StepUpService,
    private readonly sessionEpoch: SessionEpochService,
    private readonly totpReplay: TotpReplayService,
  ) {}

  private remainingBackupHashes(): string[] {
    return this.config.backupCodeHashes.filter(
      (hash) => !this.totpReplay.isBackupCodeConsumed(hash),
    );
  }

  private recordTotpUse(
    subject: string,
    result: { usedBackupCodeHash?: string; timeStep?: number },
  ): void {
    if (result.timeStep !== undefined) {
      this.totpReplay.recordTimeStep(subject, result.timeStep);
    }
    if (result.usedBackupCodeHash) {
      this.totpReplay.consumeBackupCode(result.usedBackupCodeHash, Date.now());
      this.logger.warn(
        { remaining: this.remainingBackupHashes().length },
        'admin_backup_code_consumed',
      );
    }
  }

  async login(login: string, password: string, totp: string): Promise<AuthTokens> {
    const lockoutKey = login.toLowerCase();
    const { locked, secondsRemaining } = this.lockout.isLocked(lockoutKey);
    if (locked) {
      throw new UnauthorizedException(`Too many failed attempts. Retry in ${secondsRemaining}s.`);
    }

    // Username/password failures are NOT counted toward account lockout: that would let
    // an unauthenticated attacker lock out the admin by spamming wrong passwords (DoS).
    // The per-route throttle bounds password guessing; lockout only escalates on TOTP failure.
    if (login !== this.config.login) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordOk = await bcrypt.compare(password, this.config.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const totpResult = verifyTotp(
      totp,
      this.config.totpSecret,
      this.remainingBackupHashes(),
      this.totpReplay.lastTimeStep(login),
    );
    if (!totpResult.ok) {
      this.lockout.registerFailure(lockoutKey);
      throw new UnauthorizedException('Invalid TOTP code');
    }

    this.recordTotpUse(login, totpResult);
    this.lockout.clear(lockoutKey);
    return this.issueTokens(login);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const claims = await this.verifyToken(refreshToken, this.config.refreshSecret, 'refresh');
    if (this.revocation.isRevoked(claims.jti)) {
      this.sessionEpoch.bump(claims.sub);
      this.logger.warn({ sub: claims.sub, jti: claims.jti }, 'admin_refresh_token_reuse_detected');
      throw new UnauthorizedException('Refresh token reuse detected');
    }
    this.revocation.revoke(claims.jti, claims.exp);
    return this.issueTokens(claims.sub);
  }

  async logout(refreshToken: string | undefined, accessJti: string | undefined): Promise<void> {
    if (refreshToken) {
      try {
        const claims = await this.verifyToken(refreshToken, this.config.refreshSecret, 'refresh');
        this.revocation.revoke(claims.jti, claims.exp);
      } catch {
        /* ignore — already invalid */
      }
    }
    if (accessJti) {
      const accessExpiresAt = Math.floor(Date.now() / 1000) + this.config.accessTtlSec;
      this.revocation.revoke(accessJti, accessExpiresAt);
    }
  }

  logoutAll(subject: string): { epoch: number } {
    const epoch = this.sessionEpoch.bump(subject);
    return { epoch };
  }

  async stepUpVerify(subject: string, action: string, totp: string): Promise<number> {
    const lockoutKey = `stepup::${subject}`;
    const { locked, secondsRemaining } = this.lockout.isLocked(lockoutKey);
    if (locked) {
      throw new UnauthorizedException(
        `Too many failed step-up attempts. Retry in ${secondsRemaining}s.`,
      );
    }
    const totpResult = verifyTotp(
      totp,
      this.config.totpSecret,
      this.remainingBackupHashes(),
      this.totpReplay.lastTimeStep(subject),
    );
    if (!totpResult.ok) {
      this.lockout.registerFailure(lockoutKey);
      throw new UnauthorizedException('Invalid TOTP code');
    }
    this.recordTotpUse(subject, totpResult);
    this.lockout.clear(lockoutKey);
    return this.stepUp.grant(subject, action);
  }

  async verifyAccess(token: string): Promise<AuthClaims> {
    const claims = await this.verifyToken(token, this.config.accessSecret, 'access');
    if (this.revocation.isRevoked(claims.jti)) {
      throw new UnauthorizedException('Token revoked');
    }
    return claims;
  }

  consumeStepUp(subject: string, action: string): boolean {
    return this.stepUp.consume(subject, action);
  }

  private issueTokens(login: string): AuthTokens {
    const accessJti = randomUUID();
    const refreshJti = randomUUID();
    const nowSec = Math.floor(Date.now() / 1000);
    const accessExp = nowSec + this.config.accessTtlSec;
    const refreshExp = nowSec + this.config.refreshTtlSec;
    const epoch = this.sessionEpoch.current(login);
    const accessToken = this.jwt.sign(
      { sub: login, scope: 'access', jti: accessJti, epoch },
      {
        secret: this.config.accessSecret,
        expiresIn: this.config.accessTtlSec,
        algorithm: 'HS256',
      },
    );
    const refreshToken = this.jwt.sign(
      { sub: login, scope: 'refresh', jti: refreshJti, epoch },
      {
        secret: this.config.refreshSecret,
        expiresIn: this.config.refreshTtlSec,
        algorithm: 'HS256',
      },
    );
    return {
      accessToken,
      accessExpiresAt: accessExp,
      refreshToken,
      refreshExpiresAt: refreshExp,
    };
  }

  private async verifyToken(
    token: string,
    secret: string,
    expectedScope: 'access' | 'refresh',
  ): Promise<AuthClaims> {
    try {
      const payload = await this.jwt.verifyAsync<AuthClaims>(token, {
        secret,
        algorithms: ['HS256'],
      });
      if (payload.scope !== expectedScope) {
        throw new UnauthorizedException('Wrong token scope');
      }
      const currentEpoch = this.sessionEpoch.current(payload.sub);
      if ((payload.epoch ?? 0) < currentEpoch) {
        throw new UnauthorizedException('Session revoked');
      }
      return payload;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid token');
    }
  }
}
