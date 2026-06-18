import type { ThemePreference } from './settings';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'dotlearn-theme';

const prefersDark = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

const resolvedSystemTheme = (): Theme => (prefersDark() ? 'dark' : 'light');

export const readThemePreference = (): ThemePreference => {
  if (typeof window === 'undefined') {
    return 'system';
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
};

export const readStoredTheme = (): Theme => {
  const preference = readThemePreference();
  if (preference === 'light' || preference === 'dark') {
    return preference;
  }
  return resolvedSystemTheme();
};

export const resolveTheme = (preference: ThemePreference): Theme =>
  preference === 'system' ? resolvedSystemTheme() : preference;

export const applyTheme = (theme: Theme): void => {
  if (typeof document === 'undefined') {
    return;
  }
  document.documentElement.classList.toggle('dark', theme === 'dark');
};

export const persistThemePreference = (preference: ThemePreference): void => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, preference);
};

export const persistTheme = (theme: Theme): void => {
  persistThemePreference(theme);
};

export const setThemePreference = (preference: ThemePreference): void => {
  persistThemePreference(preference);
  applyTheme(resolveTheme(preference));
};

let mediaQuery: MediaQueryList | undefined;
let mediaListener: ((event: MediaQueryListEvent) => void) | undefined;

export const watchSystemTheme = (): (() => void) => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => undefined;
  }
  if (mediaQuery && mediaListener) {
    mediaQuery.removeEventListener('change', mediaListener);
  }
  mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaListener = (): void => {
    if (readThemePreference() === 'system') {
      applyTheme(resolvedSystemTheme());
    }
  };
  mediaQuery.addEventListener('change', mediaListener);
  return () => {
    if (mediaQuery && mediaListener) {
      mediaQuery.removeEventListener('change', mediaListener);
      mediaQuery = undefined;
      mediaListener = undefined;
    }
  };
};

export const initTheme = (): void => {
  applyTheme(readStoredTheme());
  watchSystemTheme();
};
