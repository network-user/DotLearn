import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

const DEFAULT_PORT = 3000;
const isProduction = process.env.NODE_ENV === 'production';

const DEFAULT_SYNC_BODY_LIMIT_BYTES = 2_097_152;

const parseSyncBodyLimitBytes = (): number => {
  const parsed = Number.parseInt(process.env.SYNC_BODY_LIMIT_BYTES ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_SYNC_BODY_LIMIT_BYTES;
};

const securityHeaders = (_request: Request, response: Response, next: NextFunction): void => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  // JSON-only API: lock the document context down entirely (it never renders HTML/scripts).
  response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
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
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  const logger = app.get(Logger);
  app.useLogger(logger);

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.disable('x-powered-by');
  const parsedProxyHops = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? '', 10);
  const trustProxyHops =
    Number.isInteger(parsedProxyHops) && parsedProxyHops >= 0 ? parsedProxyHops : 0;
  expressApp.set('trust proxy', trustProxyHops);
  if (isProduction && trustProxyHops === 0) {
    logger.warn(
      'TRUSTED_PROXY_HOPS=0 in production: the rate limiter will bucket every request under the ' +
        'proxy IP. Set it to the number of reverse proxies in front of the API ' +
        "(count every hop: Caddy alone = 1, Caddy + this stack's nginx = 2).",
    );
  }

  app.setGlobalPrefix('api');
  app.use(cookieParser());
  // Blobs carry a base64-inflated gzip snapshot, so /api/sync gets a higher body
  // cap than the rest of the (JSON-only) API. The second, global json() parser
  // skips bodies express.json() already parsed, so this only widens the limit
  // for the one route that needs it.
  app.use('/api/sync', json({ limit: parseSyncBodyLimitBytes() }));
  app.use(json({ limit: '100kb' }));
  app.use(urlencoded({ extended: true, limit: '100kb' }));
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
  const host = process.env.HOST ?? '127.0.0.1';
  await app.listen(port, host);
};

bootstrap().catch((error: unknown) => {
  // Guaranteed to reach stderr (docker logs) regardless of whether the pino logger
  // ever got wired up — bootstrap can fail before app.useLogger() runs.
  console.error('FATAL: API failed to start.', error);
  process.exit(1);
});
