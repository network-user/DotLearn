import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';

import { DomainError } from '../errors/domain-error';

type ErrorEnvelope = {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  path: string;
  timestamp: string;
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const envelope = this.toEnvelope(exception, request);
    const status = this.toStatus(exception);

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error({ envelope, exception }, 'unhandled exception');
    } else {
      this.logger.debug({ envelope }, 'client error');
    }

    response.status(status).json(envelope);
  }

  private toStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    if (exception instanceof DomainError) {
      return exception.status;
    }
    if (exception instanceof ZodError) {
      return HttpStatus.BAD_REQUEST;
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private toEnvelope(exception: unknown, request: Request): ErrorEnvelope {
    const base = {
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const message = typeof response === 'string' ? response : (response as { message?: string }).message ?? exception.message;
      return {
        ok: false,
        error: {
          code: exception.name,
          message,
          ...(typeof response === 'object' ? { details: response } : {}),
        },
        ...base,
      };
    }

    if (exception instanceof DomainError) {
      return {
        ok: false,
        error: {
          code: exception.code,
          message: exception.message,
        },
        ...base,
      };
    }

    if (exception instanceof ZodError) {
      return {
        ok: false,
        error: {
          code: 'ZodValidationError',
          message: 'Validation failed',
          details: exception.issues,
        },
        ...base,
      };
    }

    return {
      ok: false,
      error: {
        code: 'InternalServerError',
        message: 'Unexpected server error',
      },
      ...base,
    };
  }
}
