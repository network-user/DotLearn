import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import type { HiddenTopicPublic } from '@dotlearn/contracts';

import { HiddenTopicsService } from './hidden-topics.service';

@ApiTags('topics')
@Controller('topics')
export class HiddenTopicsController {
  constructor(private readonly hiddenTopics: HiddenTopicsService) {}

  @Get('hidden')
  @ApiOperation({ summary: 'List slugs of topics hidden by maintainers.' })
  async list(): Promise<HiddenTopicPublic[]> {
    return this.hiddenTopics.list();
  }
}
