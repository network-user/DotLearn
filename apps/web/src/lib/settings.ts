import { useSyncExternalStore } from 'react';

export type AccentId = 'blue' | 'violet' | 'teal' | 'rose' | 'amber' | 'graphite';
export type ReadingSize = 'compact' | 'normal' | 'comfortable';
export type MotionPref = 'system' | 'reduced';

export interface AppSettings {
  accent: AccentId;
  reading: ReadingSize;
  motion: MotionPref;
  dailyGoal: number;
}

export const ACCENT_IDS: readonly AccentId[] = [
  'blue',
  'violet',
  'teal',
  'rose',
  'amber',
  'graphite',
];

export const READING_SIZES: readonly ReadingSize[] = ['compact', 'normal', 'comfortable'];

export const DAILY_GOAL_MIN = 1;
export const DAILY_GOAL_MAX = 50;

export const DEFAULT_SETTINGS: AppSettings = {
  accent: 'blue',
  reading: 'normal',
  motion: 'system',
  dailyGoal: 5,
};

const STORAGE_KEY = 'dotlearn:settings';

const clampGoal = (value: number): number =>
  Number.isFinite(value)
    ? Math.min(DAILY_GOAL_MAX, Math.max(DAILY_GOAL_MIN, Math.round(value)))
    : DEFAULT_SETTINGS.dailyGoal;

const sanitize = (raw: unknown): AppSettings => {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };
  const value = raw as Record<string, unknown>;
  return {
    accent: ACCENT_IDS.includes(value.accent as AccentId)
      ? (value.accent as AccentId)
      : DEFAULT_SETTINGS.accent,
    reading: READING_SIZES.includes(value.reading as ReadingSize)
      ? (value.reading as ReadingSize)
      : DEFAULT_SETTINGS.reading,
    motion: value.motion === 'reduced' ? 'reduced' : 'system',
    dailyGoal: typeof value.dailyGoal === 'number' ? clampGoal(value.dailyGoal) : DEFAULT_SETTINGS.dailyGoal,
  };
};

let current: AppSettings = { ...DEFAULT_SETTINGS };
const listeners = new Set<() => void>();

const read = (): AppSettings => {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? sanitize(JSON.parse(raw)) : { ...DEFAULT_SETTINGS };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
};

export const applySettings = (settings: AppSettings): void => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (settings.accent === 'blue') delete root.dataset.accent;
  else root.dataset.accent = settings.accent;
  if (settings.reading === 'normal') delete root.dataset.reading;
  else root.dataset.reading = settings.reading;
  if (settings.motion === 'reduced') root.dataset.motion = 'reduced';
  else delete root.dataset.motion;
};

export const initSettings = (): void => {
  current = read();
  applySettings(current);
};

export const getSettings = (): AppSettings => current;

const persist = (): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    /* ignore */
  }
};

const emit = (): void => {
  for (const listener of listeners) listener();
};

export const setSettings = (patch: Partial<AppSettings>): void => {
  current = { ...current, ...patch };
  if (patch.dailyGoal !== undefined) current = { ...current, dailyGoal: clampGoal(current.dailyGoal) };
  applySettings(current);
  persist();
  emit();
};

export const resetSettings = (): void => {
  current = { ...DEFAULT_SETTINGS };
  applySettings(current);
  persist();
  emit();
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useSettings = (): AppSettings =>
  useSyncExternalStore(subscribe, getSettings, () => DEFAULT_SETTINGS);
