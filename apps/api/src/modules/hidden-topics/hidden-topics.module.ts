import { Module } from '@nestjs/common';

import { AdminHiddenTopicsController } from './admin-hidden-topics.controller';
import { HiddenTopicsController } from './hidden-topics.controller';
import { HiddenTopicsService } from './hidden-topics.service';
import {
  HIDDEN_TOPICS_REPOSITORY,
} from './infrastructure/hidden-topics.repository';
import { JsonFileHiddenTopicsRepository } from './infrastructure/json-file-hidden-topics.repository';

@Module({
  controllers: [HiddenTopicsController, AdminHiddenTopicsController],
  providers: [
    HiddenTopicsService,
    {
      provide: HIDDEN_TOPICS_REPOSITORY,
      useClass: JsonFileHiddenTopicsRepository,
    },
  ],
  exports: [HiddenTopicsService],
})
export class HiddenTopicsModule {}
