import { Module } from '@nestjs/common';

import { AdminSubmissionsController } from './admin-submissions.controller';
import { JsonFileSubmissionsRepository } from './infrastructure/json-file-submissions.repository';
import { SUBMISSIONS_REPOSITORY } from './infrastructure/submissions.repository';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';

@Module({
  controllers: [SubmissionsController, AdminSubmissionsController],
  providers: [
    SubmissionsService,
    {
      provide: SUBMISSIONS_REPOSITORY,
      useClass: JsonFileSubmissionsRepository,
    },
  ],
  exports: [SubmissionsService, SUBMISSIONS_REPOSITORY],
})
export class SubmissionsModule {}
