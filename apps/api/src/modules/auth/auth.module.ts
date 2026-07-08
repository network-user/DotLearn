import { Global, Logger, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import {
  AUTH_CONFIG,
  AUTH_CONFIG_ERROR,
  type AuthConfigResult,
  resolveAuthConfig,
  UNCONFIGURED_AUTH_CONFIG,
} from './auth.config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LockoutService } from './domain/lockout.service';
import { SessionEpochService } from './domain/session-epoch.service';
import { StepUpService } from './domain/step-up.service';
import { TokenRevocationService } from './domain/token-revocation.service';
import { TotpReplayService } from './domain/totp-replay.service';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { AuthConfigGuard } from './guards/auth-config.guard';
import { StepUpGuard } from './guards/step-up.guard';

const AUTH_CONFIG_RESULT = Symbol('AuthConfigResult');
const authConfigLogger = new Logger('AuthConfig');

@Global()
@Module({
  imports: [
    JwtModule.register({ signOptions: { algorithm: 'HS256' } }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 100,
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [
    {
      provide: AUTH_CONFIG_RESULT,
      useFactory: (): AuthConfigResult => {
        const result = resolveAuthConfig();
        if (!result.ok) {
          // Buffered by Nest until app.useLogger() runs in main.ts, then flushed —
          // this is the one place that must never go silent (see 2026-07-06 incident).
          authConfigLogger.error(`Admin auth is disabled until this is fixed: ${result.error}`);
        }
        return result;
      },
    },
    {
      provide: AUTH_CONFIG,
      useFactory: (result: AuthConfigResult) =>
        result.ok ? result.config : UNCONFIGURED_AUTH_CONFIG,
      inject: [AUTH_CONFIG_RESULT],
    },
    {
      provide: AUTH_CONFIG_ERROR,
      useFactory: (result: AuthConfigResult) => (result.ok ? null : result.error),
      inject: [AUTH_CONFIG_RESULT],
    },
    AuthService,
    LockoutService,
    SessionEpochService,
    StepUpService,
    TokenRevocationService,
    TotpReplayService,
    AdminAuthGuard,
    AuthConfigGuard,
    StepUpGuard,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [AuthService, AdminAuthGuard, StepUpGuard, AUTH_CONFIG_ERROR],
})
export class AuthModule {}
