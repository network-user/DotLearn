export interface AuthConfig {
  login: string;
  passwordHash: string;
  totpSecret: string;
  backupCodeHashes: string[];
  accessSecret: string;
  refreshSecret: string;
  accessTtlSec: number;
  refreshTtlSec: number;
  stepUpTtlSec: number;
  lockoutTtlSec: number;
  loginWindowSec: number;
  maxFailedAttempts: number;
  cookieDomain: string | undefined;
  cookieSecure: boolean;
}

const parseInteger = (raw: string | undefined, fallback: number): number => {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseBackupCodes = (raw: string | undefined): string[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) {
      return parsed;
    }
  } catch {
    /* fall through */
  }
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
};

export const loadAuthConfig = (): AuthConfig => {
  const login = process.env.ADMIN_LOGIN ?? '';
  const passwordHash = process.env.ADMIN_PASSWORD_HASH ?? '';
  const totpSecret = process.env.ADMIN_TOTP_SECRET ?? '';
  const accessSecret = process.env.ADMIN_JWT_SECRET ?? '';
  const refreshSecret = process.env.ADMIN_REFRESH_SECRET ?? '';
  const missing: string[] = [];
  if (!login) missing.push('ADMIN_LOGIN');
  if (!passwordHash) missing.push('ADMIN_PASSWORD_HASH');
  if (!totpSecret) missing.push('ADMIN_TOTP_SECRET');
  if (!accessSecret) missing.push('ADMIN_JWT_SECRET');
  if (!refreshSecret) missing.push('ADMIN_REFRESH_SECRET');
  if (missing.length > 0) {
    throw new Error(
      `Auth not configured. Set: ${missing.join(', ')}. ` +
        'Use pnpm admin:hash / admin:totp / admin:jwt-secret to generate them.',
    );
  }
  const minSecretLength = 32;
  const weak: string[] = [];
  if (accessSecret.length < minSecretLength) weak.push('ADMIN_JWT_SECRET');
  if (refreshSecret.length < minSecretLength) weak.push('ADMIN_REFRESH_SECRET');
  if (totpSecret.length < 16) weak.push('ADMIN_TOTP_SECRET');
  if (weak.length > 0) {
    throw new Error(
      `Weak admin secret(s): ${weak.join(', ')}. JWT secrets must be >= ${minSecretLength} chars ` +
        'and the TOTP secret >= 16. Regenerate with pnpm admin:jwt-secret / admin:totp.',
    );
  }
  if (refreshSecret === accessSecret) {
    throw new Error(
      'ADMIN_REFRESH_SECRET must differ from ADMIN_JWT_SECRET so a leaked access ' +
        'secret cannot forge refresh tokens. Run pnpm admin:jwt-secret for two distinct values.',
    );
  }
  return {
    login,
    passwordHash,
    totpSecret,
    backupCodeHashes: parseBackupCodes(process.env.ADMIN_BACKUP_CODES_HASHED),
    accessSecret,
    refreshSecret,
    accessTtlSec: parseInteger(process.env.ADMIN_ACCESS_TTL, 900),
    refreshTtlSec: parseInteger(process.env.ADMIN_REFRESH_TTL, 604800),
    stepUpTtlSec: parseInteger(process.env.ADMIN_STEPUP_TTL, 120),
    lockoutTtlSec: parseInteger(process.env.ADMIN_LOCKOUT_TTL, 300),
    loginWindowSec: parseInteger(process.env.ADMIN_LOGIN_WINDOW, 900),
    maxFailedAttempts: parseInteger(process.env.ADMIN_MAX_FAILED_ATTEMPTS, 5),
    cookieDomain: process.env.ADMIN_COOKIE_DOMAIN ?? undefined,
    cookieSecure: process.env.NODE_ENV === 'production',
  };
};

export const AUTH_CONFIG = Symbol('AuthConfig');
