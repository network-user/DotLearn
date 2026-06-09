import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

import { SubmissionsModule } from './modules/submissions/submissions.module';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : {
                target: 'pino-pretty',
                options: { singleLine: true, translateTime: 'SYS:HH:MM:ss' },
              },
        autoLogging: true,
        redact: ['req.headers.authorization', 'req.headers.cookie'],
      },
    }),
    SubmissionsModule,
  ],
})
export class AppModule {}
