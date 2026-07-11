import { Body, Controller, HttpCode, HttpStatus, Post, UsePipes } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import {
  SyncCreateInput,
  type SyncCreateOutput,
  SyncDeleteInput,
  type SyncDeleteOutput,
  SyncLinkInput,
  type SyncLinkOutput,
  SyncPullInput,
  type SyncPullOutput,
  SyncPushInput,
  type SyncPushOutput,
} from '@dotlearn/contracts';

import { ZodBodyPipe } from '../../common/zod/zod-body.pipe';
// Value import: emitDecoratorMetadata needs the runtime class for Nest DI
import { SyncService } from './sync.service';

// Anonymous cross-device sync. The code is the bearer secret and is never
// logged (pino, Caddy): it travels exclusively in POST bodies, and the server
// only ever stores/looks up sha256(code). The server treats the blob as
// opaque - it is never parsed, only stored and returned.
@ApiTags('sync')
@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post('create')
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mint a new anonymous sync code.' })
  @ApiResponse({ status: HttpStatus.OK, description: 'New code and initial rev (0).' })
  @ApiResponse({ status: HttpStatus.SERVICE_UNAVAILABLE, description: 'Sync capacity reached.' })
  @UsePipes(new ZodBodyPipe(SyncCreateInput))
  create(@Body() _body: SyncCreateInput): Promise<SyncCreateOutput> {
    return this.sync.create();
  }

  @Post('link')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Attach a device to an existing sync code.' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Current rev, updatedAt and blob size.' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Unknown code.' })
  @UsePipes(new ZodBodyPipe(SyncLinkInput))
  link(@Body() body: SyncLinkInput): Promise<SyncLinkOutput> {
    return this.sync.link(body.code);
  }

  @Post('pull')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Fetch the snapshot if it changed since sinceRev.' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '{changed:false, rev} without reading the blob, or {changed:true, ...} with it.',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Unknown code.' })
  @UsePipes(new ZodBodyPipe(SyncPullInput))
  pull(@Body() body: SyncPullInput): Promise<SyncPullOutput> {
    return this.sync.pull(body.code, body.sinceRev);
  }

  @Post('push')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Push a new snapshot with optimistic concurrency on rev.' })
  @ApiResponse({ status: HttpStatus.OK, description: 'New rev and updatedAt.' })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'baseRev is stale; details carry {code: "REV_CONFLICT", currentRev}.',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Decoded blob exceeds the size cap.',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Unknown code.' })
  @UsePipes(new ZodBodyPipe(SyncPushInput))
  push(@Body() body: SyncPushInput): Promise<SyncPushOutput> {
    return this.sync.push(body.code, body.baseRev, body.blob);
  }

  @Post('delete')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a sync code and its blob (idempotent).' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Always {deleted:true}.' })
  @UsePipes(new ZodBodyPipe(SyncDeleteInput))
  delete(@Body() body: SyncDeleteInput): Promise<SyncDeleteOutput> {
    return this.sync.remove(body.code);
  }
}
