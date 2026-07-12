import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import {
  PresenceBeatInput,
  type PresenceAnalytics,
  type PresenceCounters,
  type PresenceStats,
} from '@dotlearn/contracts';

import { ZodBodyPipe } from '../../common/zod/zod-body.pipe';
// Value import: emitDecoratorMetadata needs the runtime class for Nest DI
import { PresenceService } from './presence.service';

// Public, unauthenticated anonymous online counter. No IP or User-Agent is read,
// stored, or logged; the only identifier is the client-generated random UUID.
@ApiTags('presence')
@Controller('presence')
export class PresenceController {
  constructor(private readonly presence: PresenceService) {}

  @Post('beat')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Anonymous presence heartbeat; returns live counters.' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Current online and today-uniques counts.' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation failed.' })
  @UsePipes(new ZodBodyPipe(PresenceBeatInput))
  beat(@Body() body: PresenceBeatInput): PresenceCounters {
    return this.presence.beat(body.id, body.visitorId, body.topic);
  }

  @Get('stats')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Public presence stats: online, today-uniques, 24h series, 30d daily.' })
  stats(): PresenceStats {
    return this.presence.getStats();
  }

  @Get('analytics')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Extended anonymous analytics incl. per-topic. Deploy-only.' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Full analytics payload.' })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Analytics disabled on this instance.',
  })
  analytics(): PresenceAnalytics {
    const data = this.presence.getAnalytics();
    if (!data) throw new NotFoundException('presence analytics disabled');
    return data;
  }
}
