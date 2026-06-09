import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { ZodBodyPipe } from '../../common/zod/zod-body.pipe';
import { AUTH_CONFIG, type AuthConfig } from './auth.config';
import { AuthService } from './auth.service';
import { RequireStepUp } from './decorators/require-step-up.decorator';
import { LoginInput, StepUpInput } from './dto/auth.schemas';
import { AdminAuthGuard, type AuthenticatedRequest } from './guards/admin-auth.guard';
import { StepUpGuard } from './guards/step-up.guard';

const REFRESH_COOKIE = 'dotlearn_admin_refresh';

@ApiTags('admin')
@Controller('admin/auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Login with username + password + TOTP code.' })
  @UsePipes(new ZodBodyPipe(LoginInput))
  async login(
    @Body() body: LoginInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ accessToken: string; accessExpiresAt: string; login: string }> {
    const tokens = await this.auth.login(body.login, body.password, body.totp);
    this.setRefreshCookie(response, tokens.refreshToken, tokens.refreshExpiresAt);
    return {
      accessToken: tokens.accessToken,
      accessExpiresAt: new Date(tokens.accessExpiresAt * 1000).toISOString(),
      login: body.login,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Exchange a refresh cookie for a fresh access token.' })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ accessToken: string; accessExpiresAt: string }> {
    const refresh = request.cookies?.[REFRESH_COOKIE];
    if (!refresh || typeof refresh !== 'string') {
      response.status(HttpStatus.UNAUTHORIZED);
      throw new Error('Missing refresh cookie');
    }
    const tokens = await this.auth.refresh(refresh);
    this.setRefreshCookie(response, tokens.refreshToken, tokens.refreshExpiresAt);
    return {
      accessToken: tokens.accessToken,
      accessExpiresAt: new Date(tokens.accessExpiresAt * 1000).toISOString(),
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke the current refresh and access tokens.' })
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const refresh = request.cookies?.[REFRESH_COOKIE];
    const accessJti = request.admin?.jti;
    await this.auth.logout(
      typeof refresh === 'string' ? refresh : undefined,
      accessJti,
    );
    response.clearCookie(REFRESH_COOKIE, this.cookieOptions(true));
  }

  @Post('step-up')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Authorise a sensitive action with a fresh TOTP code.' })
  @UsePipes(new ZodBodyPipe(StepUpInput))
  async stepUp(
    @Req() request: AuthenticatedRequest,
    @Body() body: StepUpInput,
  ): Promise<{ action: string; expiresAt: string }> {
    if (!request.admin) {
      throw new Error('Authentication required');
    }
    const expiresAtMs = await this.auth.stepUpVerify(request.admin.sub, body.action, body.totp);
    return {
      action: body.action,
      expiresAt: new Date(expiresAtMs).toISOString(),
    };
  }

  @Post('me')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminAuthGuard)
  @ApiOperation({ summary: 'Echo the current admin session, used for hydration.' })
  me(@Req() request: AuthenticatedRequest): { login: string | undefined; expiresAt: string } {
    return {
      login: request.admin?.sub,
      expiresAt: new Date((request.admin?.exp ?? 0) * 1000).toISOString(),
    };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AdminAuthGuard, StepUpGuard)
  @RequireStepUp('auth.logout-all')
  @ApiOperation({ summary: 'Revoke every active access and refresh token for the admin.' })
  async logoutAll(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    if (!request.admin) {
      throw new Error('Authentication required');
    }
    this.auth.logoutAll(request.admin.sub);
    response.clearCookie(REFRESH_COOKIE, this.cookieOptions(true));
  }

  private setRefreshCookie(response: Response, token: string, expiresAtSec: number): void {
    response.cookie(REFRESH_COOKIE, token, {
      ...this.cookieOptions(true),
      expires: new Date(expiresAtSec * 1000),
    });
  }

  private cookieOptions(forRefresh: boolean) {
    return {
      httpOnly: true,
      secure: this.config.cookieSecure,
      sameSite: this.config.cookieSecure ? ('strict' as const) : ('lax' as const),
      path: forRefresh ? '/api/admin/auth' : '/',
      ...(this.config.cookieDomain ? { domain: this.config.cookieDomain } : {}),
    };
  }
}
