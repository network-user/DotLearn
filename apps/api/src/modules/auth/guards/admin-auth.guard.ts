import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';

import type { AuthClaims } from '../auth.service';
import { AuthService } from '../auth.service';

export interface AuthenticatedRequest extends Request {
  admin?: AuthClaims;
}

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing Bearer token');
    }
    const claims = await this.auth.verifyAccess(token);
    request.admin = claims;
    return true;
  }
}
