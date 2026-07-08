import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { AUTH_CONFIG_ERROR } from '../auth/auth.config';

// Public, unauthenticated liveness probe. `@SkipThrottle` keeps container/orchestrator
// health checks (and the front proxy's upstream checks) from consuming the rate limit.
// Only a boolean is exposed for auth — the actual missing/weak var names stay in logs.
@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(@Inject(AUTH_CONFIG_ERROR) private readonly authConfigError: string | null) {}

  @Get()
  @ApiOperation({ summary: 'Liveness probe for container and reverse-proxy health checks.' })
  check(): { status: 'ok'; authConfigured: boolean } {
    return { status: 'ok', authConfigured: this.authConfigError === null };
  }
}
