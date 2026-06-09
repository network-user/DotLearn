import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AuthService } from '../auth.service';
import { STEP_UP_ACTION_KEY } from '../decorators/require-step-up.decorator';
import type { AuthenticatedRequest } from './admin-auth.guard';

@Injectable()
export class StepUpGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const action = this.reflector.getAllAndOverride<string | undefined>(STEP_UP_ACTION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!action) return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const claims = request.admin;
    if (!claims) {
      throw new ForbiddenException('Step-up requires authentication first');
    }
    const ok = this.auth.consumeStepUp(claims.sub, action);
    if (!ok) {
      throw new ForbiddenException({
        message: 'Step-up verification required',
        action,
      });
    }
    return true;
  }
}
