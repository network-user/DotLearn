import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

const DEFAULT_PORT = 3000;
const isProduction = process.env.NODE_ENV === 'production';

const securityHeaders = (_request: Request, response: Response, next: NextFunction): void => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (isProduction) {
    response.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  }
  next();
};

const parseAllowedOrigins = (): string[] => {
  const raw = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const bootstrap = async (): Promise<void> => {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.disable('x-powered-by');
  expressApp.set('trust proxy', Number(process.env.TRUSTED_PROXY_HOPS ?? 0));

  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.use(securityHeaders);
  app.enableCors({
    origin: parseAllowedOrigins(),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('DotLearn API')
      .setDescription('Submissions and admin endpoints for DotLearn.')
      .setVersion('0.0.1')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document);
  }

  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  const host = process.env.HOST ?? '0.0.0.0';
  await app.listen(port, host);
};

void bootstrap();
