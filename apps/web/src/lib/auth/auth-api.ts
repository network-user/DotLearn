const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:3000';

export interface LoginPayload {
  login: string;
  password: string;
  totp: string;
}

export interface LoginResult {
  accessToken: string;
  accessExpiresAt: string;
  login: string;
}

export interface RefreshResult {
  accessToken: string;
  accessExpiresAt: string;
}

export interface StepUpResult {
  action: string;
  expiresAt: string;
}

interface SuccessEnvelope<T> {
  ok: true;
  data: T;
  timestamp: string;
}

interface ErrorEnvelope {
  ok: false;
  error?: { message?: string };
}

export class AuthApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AuthApiError';
  }
}

const parseEnvelope = async <T>(response: Response): Promise<T> => {
  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  if (!text) {
    if (response.ok) return undefined as T;
    throw new AuthApiError(response.status, `${response.status} ${response.statusText}`);
  }
  let parsed: SuccessEnvelope<T> | ErrorEnvelope | T;
  try {
    parsed = JSON.parse(text) as SuccessEnvelope<T> | ErrorEnvelope | T;
  } catch {
    throw new AuthApiError(response.status, text);
  }
  if (!response.ok) {
    const message =
      typeof parsed === 'object' && parsed !== null && 'error' in parsed
        ? (parsed as ErrorEnvelope).error?.message ?? `${response.status} ${response.statusText}`
        : `${response.status} ${response.statusText}`;
    throw new AuthApiError(response.status, message);
  }
  if (typeof parsed === 'object' && parsed !== null && 'ok' in parsed && (parsed as SuccessEnvelope<T>).ok) {
    return (parsed as SuccessEnvelope<T>).data;
  }
  return parsed as T;
};

const post = async <T>(path: string, body: unknown, accessToken?: string): Promise<T> => {
  const init: RequestInit = {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }
  const response = await fetch(`${API_BASE}${path}`, init);
  return parseEnvelope<T>(response);
};

export const login = (payload: LoginPayload): Promise<LoginResult> =>
  post<LoginResult>('/api/admin/auth/login', payload);

export const refresh = (): Promise<RefreshResult> =>
  post<RefreshResult>('/api/admin/auth/refresh', undefined);

export const logout = (accessToken?: string): Promise<void> =>
  post<void>('/api/admin/auth/logout', undefined, accessToken);

export const stepUp = (accessToken: string, action: string, totp: string): Promise<StepUpResult> =>
  post<StepUpResult>('/api/admin/auth/step-up', { action, totp }, accessToken);

export const me = (
  accessToken: string,
): Promise<{ login: string | undefined; expiresAt: string }> =>
  post<{ login: string | undefined; expiresAt: string }>(
    '/api/admin/auth/me',
    undefined,
    accessToken,
  );
