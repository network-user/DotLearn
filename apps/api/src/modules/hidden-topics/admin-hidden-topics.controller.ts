import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { HideTopicInput, type HiddenTopic } from '@dotlearn/contracts';

import type { AdminActor } from '../../common/audit/admin-actor';
import { ZodBodyPipe } from '../../common/zod/zod-body.pipe';
import { RequireStepUp } from '../auth/decorators/require-step-up.decorator';
import type { AuthenticatedRequest } from '../auth/guards/admin-auth.guard';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { StepUpGuard } from '../auth/guards/step-up.guard';
// Value import: emitDecoratorMetadata needs the runtime class for Nest DI
import type { HiddenTopicsService } from './hidden-topics.service';

const SLUG_REGEX = /^[a-z][a-z0-9-]*[a-z0-9]$/;

const actorFrom = (request: AuthenticatedRequest): AdminActor => ({
  jti: request.admin?.jti ?? 'unknown',
  ip: request.ip ?? 'unknown',
});

@ApiTags('admin')
@Controller('admin/topics')
@UseGuards(AdminAuthGuard, StepUpGuard)
export class AdminHiddenTopicsController {
  constructor(private readonly hiddenTopics: HiddenTopicsService) {}

  @Post(':slug/hide')
  @HttpCode(HttpStatus.CREATED)
  @RequireStepUp('topics.hide')
  @ApiOperation({ summary: 'Hide a materialized topic from the public catalog.' })
  @UsePipes(new ZodBodyPipe(HideTopicInput))
  async hide(
    @Param('slug') slug: string,
    @Body() body: HideTopicInput,
    @Req() request: AuthenticatedRequest,
  ): Promise<HiddenTopic> {
    this.assertSlug(slug);
    return this.hiddenTopics.hide(slug, body.reason, actorFrom(request));
  }

  @Delete(':slug/hide')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequireStepUp('topics.unhide')
  @ApiOperation({ summary: 'Reveal a previously hidden topic.' })
  async unhide(@Param('slug') slug: string, @Req() request: AuthenticatedRequest): Promise<void> {
    this.assertSlug(slug);
    await this.hiddenTopics.unhide(slug, actorFrom(request));
  }

  private assertSlug(slug: string): void {
    if (!SLUG_REGEX.test(slug)) {
      throw new BadRequestException(`Invalid topic slug "${slug}"`);
    }
  }
}
