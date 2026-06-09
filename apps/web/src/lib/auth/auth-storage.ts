interface InMemoryAccessToken {
  token: string;
  expiresAt: number;
  login: string;
}

let current: InMemoryAccessToken | null = null;
const listeners = new Set<() => void>();

export const setAccessToken = (token: InMemoryAccessToken | null): void => {
  current = token;
  for (const listener of listeners) listener();
};

export const getAccessToken = (): InMemoryAccessToken | null => current;

export const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const SESSION_HINT_KEY = 'dotlearn:session-hint';

export const setSessionHint = (value: boolean): void => {
  try {
    if (value) {
      localStorage.setItem(SESSION_HINT_KEY, '1');
    } else {
      localStorage.removeItem(SESSION_HINT_KEY);
    }
  } catch {
    return;
  }
};

export const hasSessionHint = (): boolean => {
  try {
    return localStorage.getItem(SESSION_HINT_KEY) === '1';
  } catch {
    return false;
  }
};
