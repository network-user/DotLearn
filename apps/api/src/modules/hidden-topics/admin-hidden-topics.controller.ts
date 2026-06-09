import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { HideTopicInput, type HiddenTopic } from '@dotlearn/contracts';

import { ZodBodyPipe } from '../../common/zod/zod-body.pipe';
import { HiddenTopicsService } from './hidden-topics.service';

const SLUG_REGEX = /^[a-z][a-z0-9-]*[a-z0-9]$/;

@ApiTags('admin')
@Controller('admin/topics')
export class AdminHiddenTopicsController {
  constructor(private readonly hiddenTopics: HiddenTopicsService) {}

  @Post(':slug/hide')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Hide a materialized topic from the public catalog.' })
  @UsePipes(new ZodBodyPipe(HideTopicInput))
  async hide(@Param('slug') slug: string, @Body() body: HideTopicInput): Promise<HiddenTopic> {
    this.assertSlug(slug);
    return this.hiddenTopics.hide(slug, body.reason);
  }

  @Delete(':slug/hide')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reveal a previously hidden topic.' })
  async unhide(@Param('slug') slug: string): Promise<void> {
    this.assertSlug(slug);
    await this.hiddenTopics.unhide(slug);
  }

  private assertSlug(slug: string): void {
    if (!SLUG_REGEX.test(slug)) {
      throw new BadRequestException(`Invalid topic slug "${slug}"`);
    }
  }
}
