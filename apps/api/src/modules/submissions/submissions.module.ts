import { Module } from '@nestjs/common';

import { AdminSubmissionsController } from './admin-submissions.controller';
import { InMemorySubmissionsRepository } from './infrastructure/in-memory-submissions.repository';
import { SUBMISSIONS_REPOSITORY } from './infrastructure/submissions.repository';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';

@Module({
  controllers: [SubmissionsController, AdminSubmissionsController],
  providers: [
    SubmissionsService,
    {
      provide: SUBMISSIONS_REPOSITORY,
      useClass: InMemorySubmissionsRepository,
    },
  ],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
