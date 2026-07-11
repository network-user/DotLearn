import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { HiddenTopicsModule } from './modules/hidden-topics/hidden-topics.module';
import { PresenceModule } from './modules/presence/presence.module';
import { SubmissionsModule } from './modules/submissions/submissions.module';
import { SyncModule } from './modules/sync/sync.module';

const isProduction = process.env.NODE_ENV === 'production';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        ...(isProduction
          ? {}
          : {
              transport: {
                target: 'pino-pretty',
                options: { singleLine: true, translateTime: 'SYS:HH:MM:ss' },
              },
            }),
        autoLogging: true,
        redact: ['req.headers.authorization', 'req.headers.cookie'],
      },
    }),
    AuthModule,
    HealthModule,
    SubmissionsModule,
    HiddenTopicsModule,
    PresenceModule,
    SyncModule,
  ],
})
export class AppModule {}
