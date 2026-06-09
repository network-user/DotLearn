import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import type { HiddenTopic } from '@dotlearn/contracts';

import { HiddenTopicsService } from './hidden-topics.service';

@ApiTags('topics')
@Controller('topics')
export class HiddenTopicsController {
  constructor(private readonly hiddenTopics: HiddenTopicsService) {}

  @Get('hidden')
  @ApiOperation({ summary: 'List slugs of topics hidden by maintainers.' })
  async list(): Promise<HiddenTopic[]> {
    return this.hiddenTopics.list();
  }
}
