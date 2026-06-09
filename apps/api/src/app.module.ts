import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { HiddenTopicsModule } from './modules/hidden-topics/hidden-topics.module';
import { SubmissionsModule } from './modules/submissions/submissions.module';

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
    SubmissionsModule,
    HiddenTopicsModule,
  ],
})
export class AppModule {}
