import { useSyncExternalStore } from 'react';

import { categoryOfSlug, type CatalogCategoryId } from './catalog-categories';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export const EXPERIENCE_LEVELS: readonly ExperienceLevel[] = [
  'beginner',
  'intermediate',
  'advanced',
];

export const LEVEL_RANK: Record<ExperienceLevel, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

const isExperienceLevel = (value: unknown): value is ExperienceLevel =>
  value === 'beginner' || value === 'intermediate' || value === 'advanced';

export interface PersonalizationProfile {
  level?: ExperienceLevel;
  trackIds: string[];
  interests: CatalogCategoryId[];
  configuredAt?: string;
}

export const DEFAULT_PROFILE: PersonalizationProfile = {
  trackIds: [],
  interests: [],
};

const STORAGE_KEY = 'dotlearn:personalization';

const sanitizeStringArray = (value: unknown): string[] =>
  Array.isArray(value)
    ? [...new Set(value.filter((entry): entry is string => typeof entry === 'string'))]
    : [];

const sanitize = (raw: unknown): PersonalizationProfile => {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PROFILE };
  const value = raw as Record<string, unknown>;
  const interests = sanitizeStringArray(value.interests) as CatalogCategoryId[];
  const level = isExperienceLevel(value.level) ? value.level : undefined;
  const configuredAt = typeof value.configuredAt === 'string' ? value.configuredAt : undefined;
  return {
    ...(level !== undefined ? { level } : {}),
    trackIds: sanitizeStringArray(value.trackIds),
    interests,
    ...(configuredAt !== undefined ? { configuredAt } : {}),
  };
};

let current: PersonalizationProfile = { ...DEFAULT_PROFILE };
const listeners = new Set<() => void>();

const read = (): PersonalizationProfile => {
  if (typeof window === 'undefined') return { ...DEFAULT_PROFILE };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? sanitize(JSON.parse(raw)) : { ...DEFAULT_PROFILE };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
};

export const initPersonalization = (): void => {
  current = read();
};

export const getPersonalization = (): PersonalizationProfile => current;

export const isPersonalized = (profile: PersonalizationProfile): boolean =>
  profile.configuredAt !== undefined;

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

export const setPersonalization = (patch: Partial<PersonalizationProfile>): void => {
  current = { ...current, ...patch };
  persist();
  emit();
};

export const resetPersonalization = (): void => {
  current = { ...DEFAULT_PROFILE };
  persist();
  emit();
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const usePersonalization = (): PersonalizationProfile =>
  useSyncExternalStore(subscribe, getPersonalization, () => DEFAULT_PROFILE);

export const categoriesOfSlugs = (slugs: readonly string[]): CatalogCategoryId[] => [
  ...new Set(slugs.map((slug) => categoryOfSlug(slug))),
];
