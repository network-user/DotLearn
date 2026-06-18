import { useSyncExternalStore } from 'react';

export interface RecentVisit {
  slug: string;
  conceptId?: string;
  at: number;
}

const STORAGE_KEY = 'dotlearn:recent-visits';
const MAX_ENTRIES = 8;
const RECENT_VISITS_EVENT = 'dotlearn:recent-visits-changed';

let cache: RecentVisit[] | null = null;

const isRecentVisit = (value: unknown): value is RecentVisit =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as RecentVisit).slug === 'string' &&
  typeof (value as RecentVisit).at === 'number';

const readStorage = (): RecentVisit[] => {
  if (cache) return cache;
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cache = [];
      return cache;
    }
    const parsed: unknown = JSON.parse(raw);
    cache = Array.isArray(parsed) ? parsed.filter(isRecentVisit) : [];
  } catch {
    cache = [];
  }
  return cache;
};

const emit = (): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(RECENT_VISITS_EVENT));
};

export const recordRecentVisit = (slug: string, conceptId?: string): void => {
  if (typeof window === 'undefined') return;
  const existing = readStorage();
  const next: RecentVisit[] = [
    { slug, at: Date.now(), ...(conceptId ? { conceptId } : {}) },
    ...existing.filter((entry) => !(entry.slug === slug && entry.conceptId === conceptId)),
  ].slice(0, MAX_ENTRIES);
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    return;
  }
  emit();
};

export const getRecentVisits = (): RecentVisit[] => readStorage();

const subscribe = (listener: () => void): (() => void) => {
  if (typeof window === 'undefined') return () => undefined;
  const handler = (): void => listener();
  const storageHandler = (event: StorageEvent): void => {
    if (event.key === STORAGE_KEY) {
      cache = null;
      listener();
    }
  };
  window.addEventListener(RECENT_VISITS_EVENT, handler);
  window.addEventListener('storage', storageHandler);
  return () => {
    window.removeEventListener(RECENT_VISITS_EVENT, handler);
    window.removeEventListener('storage', storageHandler);
  };
};

export const useRecentVisits = (): RecentVisit[] =>
  useSyncExternalStore(subscribe, getRecentVisits, () => []);
