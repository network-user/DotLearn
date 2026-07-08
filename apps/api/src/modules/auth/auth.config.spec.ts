import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadAuthConfig, resolveAuthConfig } from './auth.config';

const STRONG_ACCESS = 'a'.repeat(48);
const STRONG_REFRESH = 'b'.repeat(48);
const STRONG_TOTP = 'JBSWY3DPEHPK3PXPJBSWY3DP';

const AUTH_ENV_KEYS = [
  'ADMIN_LOGIN',
  'ADMIN_PASSWORD_HASH',
  'ADMIN_TOTP_SECRET',
  'ADMIN_JWT_SECRET',
  'ADMIN_REFRESH_SECRET',
  'ADMIN_BACKUP_CODES_HASHED',
] as const;

describe('loadAuthConfig', () => {
  const snapshot = { ...process.env };

  beforeEach(() => {
    for (const key of AUTH_ENV_KEYS) delete process.env[key];
    process.env.ADMIN_LOGIN = 'admin';
    process.env.ADMIN_PASSWORD_HASH = 'bcrypt-hash';
    process.env.ADMIN_TOTP_SECRET = STRONG_TOTP;
    process.env.ADMIN_JWT_SECRET = STRONG_ACCESS;
    process.env.ADMIN_REFRESH_SECRET = STRONG_REFRESH;
  });

  afterEach(() => {
    process.env = { ...snapshot };
  });

  it('loads a valid configuration', () => {
    const config = loadAuthConfig();
    expect(config.login).toBe('admin');
    expect(config.accessSecret).toBe(STRONG_ACCESS);
    expect(config.refreshSecret).toBe(STRONG_REFRESH);
  });

  it('throws when a required secret is missing', () => {
    delete process.env.ADMIN_JWT_SECRET;
    expect(() => loadAuthConfig()).toThrow(/Auth not configured/);
  });

  it('throws when the refresh secret equals the access secret', () => {
    process.env.ADMIN_REFRESH_SECRET = STRONG_ACCESS;
    expect(() => loadAuthConfig()).toThrow(/must differ/);
  });

  it('rejects JWT secrets shorter than 32 chars', () => {
    process.env.ADMIN_JWT_SECRET = 'short';
    expect(() => loadAuthConfig()).toThrow(/Weak admin secret/);
  });

  it('rejects a TOTP secret shorter than 16 chars', () => {
    process.env.ADMIN_TOTP_SECRET = 'JBSWY3DP';
    expect(() => loadAuthConfig()).toThrow(/Weak admin secret/);
  });
});

describe('resolveAuthConfig', () => {
  const snapshot = { ...process.env };

  beforeEach(() => {
    for (const key of AUTH_ENV_KEYS) delete process.env[key];
    process.env.ADMIN_LOGIN = 'admin';
    process.env.ADMIN_PASSWORD_HASH = 'bcrypt-hash';
    process.env.ADMIN_TOTP_SECRET = STRONG_TOTP;
    process.env.ADMIN_JWT_SECRET = STRONG_ACCESS;
    process.env.ADMIN_REFRESH_SECRET = STRONG_REFRESH;
  });

  afterEach(() => {
    process.env = { ...snapshot };
  });

  it('returns ok:true with the config when env is valid', () => {
    const result = resolveAuthConfig();
    expect(result.ok).toBe(true);
    expect(result.ok && result.config.login).toBe('admin');
  });

  it('returns ok:false with the failure reason instead of throwing', () => {
    delete process.env.ADMIN_JWT_SECRET;
    const result = resolveAuthConfig();
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/Auth not configured/);
  });
});
