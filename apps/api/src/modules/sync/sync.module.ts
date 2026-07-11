import { Module } from '@nestjs/common';

import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { SyncStore } from './sync.store';

@Module({
  controllers: [SyncController],
  providers: [SyncService, SyncStore],
})
export class SyncModule {}
