import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';

import { AUTH_CONFIG_ERROR } from '../auth.config';

// Runs before every admin/auth route. When ADMIN_* env is missing or weak the app
// still boots (see auth.module.ts) so other routes keep working, but every
// login/refresh/step-up attempt must fail loudly with a clear 503 instead of running
// against the empty-secret placeholder config. The full reason is logged server-side
// only (auth.module.ts) — the client only learns that auth is unavailable.
@Injectable()
export class AuthConfigGuard implements CanActivate {
  constructor(@Inject(AUTH_CONFIG_ERROR) private readonly configError: string | null) {}

  canActivate(_context: ExecutionContext): boolean {
    if (this.configError) {
      throw new ServiceUnavailableException(
        'Admin auth is not configured on this server. Check the API logs.',
      );
    }
    return true;
  }
}
