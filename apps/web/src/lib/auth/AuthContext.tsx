import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import * as authApi from './auth-api';
import { getAccessToken, setAccessToken, subscribe } from './auth-storage';

export type AuthState =
  | { status: 'unknown' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; login: string; expiresAt: number };

interface AuthContextValue {
  state: AuthState;
  login: (payload: authApi.LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  stepUp: (action: string, totp: string) => Promise<void>;
  refreshToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const REFRESH_BUFFER_MS = 30_000;

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [state, setState] = useState<AuthState>({ status: 'unknown' });
  const refreshTimer = useRef<number | null>(null);

  const clearTimer = () => {
    if (refreshTimer.current !== null) {
      window.clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
    }
  };

  const scheduleRefresh = useCallback((expiresAtMs: number) => {
    clearTimer();
    const delay = Math.max(expiresAtMs - Date.now() - REFRESH_BUFFER_MS, 5_000);
    refreshTimer.current = window.setTimeout(() => {
      void doRefresh();
    }, delay);
  }, []);

  const doRefresh = useCallback(async (): Promise<string | null> => {
    try {
      const result = await authApi.refresh();
      const expiresAtMs = Date.parse(result.accessExpiresAt);
      const previous = getAccessToken();
      const login = previous?.login ?? '';
      setAccessToken({ token: result.accessToken, expiresAt: expiresAtMs, login });
      setState({ status: 'authenticated', login, expiresAt: expiresAtMs });
      scheduleRefresh(expiresAtMs);
      return result.accessToken;
    } catch {
      setAccessToken(null);
      setState({ status: 'unauthenticated' });
      clearTimer();
      return null;
    }
  }, [scheduleRefresh]);

  useEffect(() => {
    void doRefresh();
    return () => {
      clearTimer();
    };
  }, [doRefresh]);

  useEffect(() => {
    return subscribe(() => {
      const token = getAccessToken();
      if (!token) {
        setState({ status: 'unauthenticated' });
      }
    });
  }, []);

  const login = useCallback(
    async (payload: authApi.LoginPayload): Promise<void> => {
      const result = await authApi.login(payload);
      const expiresAtMs = Date.parse(result.accessExpiresAt);
      setAccessToken({
        token: result.accessToken,
        expiresAt: expiresAtMs,
        login: result.login,
      });
      setState({ status: 'authenticated', login: result.login, expiresAt: expiresAtMs });
      scheduleRefresh(expiresAtMs);
    },
    [scheduleRefresh],
  );

  const logout = useCallback(async (): Promise<void> => {
    const access = getAccessToken();
    try {
      await authApi.logout(access?.token);
    } catch {
      /* ignore */
    }
    setAccessToken(null);
    setState({ status: 'unauthenticated' });
    clearTimer();
  }, []);

  const logoutAll = useCallback(async (): Promise<void> => {
    const access = getAccessToken();
    if (!access) {
      throw new Error('Not authenticated');
    }
    await authApi.logoutAll(access.token);
    setAccessToken(null);
    setState({ status: 'unauthenticated' });
    clearTimer();
  }, []);

  const stepUp = useCallback(async (action: string, totp: string): Promise<void> => {
    const access = getAccessToken();
    if (!access) {
      throw new Error('Not authenticated');
    }
    await authApi.stepUp(access.token, action, totp);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ state, login, logout, logoutAll, stepUp, refreshToken: doRefresh }),
    [state, login, logout, logoutAll, stepUp, doRefresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};
