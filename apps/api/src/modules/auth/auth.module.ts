import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AUTH_CONFIG, loadAuthConfig } from './auth.config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LockoutService } from './domain/lockout.service';
import { SessionEpochService } from './domain/session-epoch.service';
import { StepUpService } from './domain/step-up.service';
import { TokenRevocationService } from './domain/token-revocation.service';
import { TotpReplayService } from './domain/totp-replay.service';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { StepUpGuard } from './guards/step-up.guard';

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
      provide: AUTH_CONFIG,
      useFactory: loadAuthConfig,
    },
    AuthService,
    LockoutService,
    SessionEpochService,
    StepUpService,
    TokenRevocationService,
    TotpReplayService,
    AdminAuthGuard,
    StepUpGuard,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [AuthService, AdminAuthGuard, StepUpGuard],
})
export class AuthModule {}
