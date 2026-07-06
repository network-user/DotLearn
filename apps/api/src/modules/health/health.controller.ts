import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

// Public, unauthenticated liveness probe. `@SkipThrottle` keeps container/orchestrator
// health checks (and the front proxy's upstream checks) from consuming the rate limit.
@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Liveness probe for container and reverse-proxy health checks.' })
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
