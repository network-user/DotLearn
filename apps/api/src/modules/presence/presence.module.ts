import { Module } from '@nestjs/common';

import { PresenceController } from './presence.controller';
import { PresenceService } from './presence.service';

@Module({
  controllers: [PresenceController],
  providers: [PresenceService],
})
export class PresenceModule {}
