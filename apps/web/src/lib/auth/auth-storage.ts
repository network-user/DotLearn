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
