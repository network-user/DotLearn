import { useSyncExternalStore } from 'react';

import { readThemePreference, setThemePreference } from './theme';

export type AccentId = 'blue' | 'violet' | 'teal' | 'rose' | 'amber' | 'graphite';
export type ReadingSize = 'compact' | 'normal' | 'comfortable';
export type ReadingFont = 'serif' | 'sans' | 'dyslexic';
export type ReadingSpacing = 'normal' | 'relaxed';
export type ReadingWidth = 'narrow' | 'default' | 'wide';
export type MotionPref = 'system' | 'reduced';
export type ThemePreference = 'system' | 'light' | 'dark';
export type ContentLanguage = 'follow-ui' | 'ru' | 'en';
export type Density = 'comfortable' | 'compact';
export type Contrast = 'system' | 'high';
export type ChallengeLevel = 'chill' | 'balanced' | 'push';
export type SessionLimit = 'all' | 10 | 20 | 50;
export type TargetRetention = 0.85 | 0.9 | 0.95;
export type EditorTabSize = 'language-default' | 2 | 4 | 8;

export interface EditorSettings {
  fontSize: number;
  tabSize: EditorTabSize;
  wordWrap: boolean;
  autocomplete: boolean;
  lineNumbers: boolean;
}

export interface QuietHours {
  start: number;
  end: number;
}

export interface ReminderSettings {
  enabled: boolean;
  hour: number;
  minute: number;
  days: number[];
  quietHours?: QuietHours;
}

export interface AppSettings {
  accent: AccentId;
  reading: ReadingSize;
  readingFont: ReadingFont;
  readingSpacing: ReadingSpacing;
  readingWidth: ReadingWidth;
  motion: MotionPref;
  themePreference: ThemePreference;
  contentLanguage: ContentLanguage;
  density: Density;
  contrast: Contrast;
  dailyGoal: number;
  newCardsPerDay: number;
  sessionLimit: SessionLimit;
  targetRetention: TargetRetention;
  weeklyGoalActiveDays?: number;
  challengeLevel: ChallengeLevel;
  editor: EditorSettings;
  reminders: ReminderSettings;
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
export const READING_FONTS: readonly ReadingFont[] = ['serif', 'sans', 'dyslexic'];
export const READING_WIDTHS: readonly ReadingWidth[] = ['narrow', 'default', 'wide'];
export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];
export const CONTENT_LANGUAGES: readonly ContentLanguage[] = ['follow-ui', 'ru', 'en'];
export const DENSITIES: readonly Density[] = ['comfortable', 'compact'];
export const CONTRASTS: readonly Contrast[] = ['system', 'high'];
export const CHALLENGE_LEVELS: readonly ChallengeLevel[] = ['chill', 'balanced', 'push'];
export const SESSION_LIMITS: readonly SessionLimit[] = [10, 20, 50, 'all'];
export const TARGET_RETENTIONS: readonly TargetRetention[] = [0.85, 0.9, 0.95];
export const EDITOR_TAB_SIZES: readonly EditorTabSize[] = ['language-default', 2, 4, 8];
export const REMINDER_DAYS: readonly number[] = [0, 1, 2, 3, 4, 5, 6];

export const DAILY_GOAL_MIN = 1;
export const DAILY_GOAL_MAX = 50;
export const NEW_CARDS_PER_DAY_MIN = 0;
export const NEW_CARDS_PER_DAY_MAX = 100;
export const WEEKLY_GOAL_MIN = 1;
export const WEEKLY_GOAL_MAX = 7;
export const EDITOR_FONT_SIZE_MIN = 11;
export const EDITOR_FONT_SIZE_MAX = 20;
export const REMINDER_HOUR_MIN = 0;
export const REMINDER_HOUR_MAX = 23;
export const REMINDER_MINUTE_MIN = 0;
export const REMINDER_MINUTE_MAX = 59;

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  fontSize: 13,
  tabSize: 'language-default',
  wordWrap: false,
  autocomplete: true,
  lineNumbers: true,
};

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: false,
  hour: 19,
  minute: 0,
  days: [0, 1, 2, 3, 4, 5, 6],
};

export const DEFAULT_SETTINGS: AppSettings = {
  accent: 'blue',
  reading: 'normal',
  readingFont: 'serif',
  readingSpacing: 'normal',
  readingWidth: 'default',
  motion: 'system',
  themePreference: 'light',
  contentLanguage: 'follow-ui',
  density: 'comfortable',
  contrast: 'system',
  dailyGoal: 5,
  newCardsPerDay: 10,
  sessionLimit: 'all',
  targetRetention: 0.9,
  challengeLevel: 'balanced',
  editor: DEFAULT_EDITOR_SETTINGS,
  reminders: DEFAULT_REMINDER_SETTINGS,
};

const STORAGE_KEY = 'dotlearn:settings';

const clampInt = (value: unknown, min: number, max: number, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback;

const clampGoal = (value: number): number =>
  Number.isFinite(value)
    ? Math.min(DAILY_GOAL_MAX, Math.max(DAILY_GOAL_MIN, Math.round(value)))
    : DEFAULT_SETTINGS.dailyGoal;

const oneOf = <T>(allowed: readonly T[], value: unknown, fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

const sanitizeWeeklyGoal = (value: unknown): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.min(WEEKLY_GOAL_MAX, Math.max(WEEKLY_GOAL_MIN, Math.round(value)));
};

const sanitizeReminderDays = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [...DEFAULT_REMINDER_SETTINGS.days];
  const days = Array.from(
    new Set(
      value.filter(
        (day): day is number =>
          typeof day === 'number' && Number.isInteger(day) && day >= 0 && day <= 6,
      ),
    ),
  ).sort((a, b) => a - b);
  return days;
};

const sanitizeQuietHours = (value: unknown): QuietHours | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const entry = value as Record<string, unknown>;
  if (typeof entry.start !== 'number' || typeof entry.end !== 'number') return undefined;
  return {
    start: clampInt(entry.start, REMINDER_HOUR_MIN, REMINDER_HOUR_MAX, REMINDER_HOUR_MIN),
    end: clampInt(entry.end, REMINDER_HOUR_MIN, REMINDER_HOUR_MAX, REMINDER_HOUR_MIN),
  };
};

const sanitizeEditor = (value: unknown): EditorSettings => {
  if (!value || typeof value !== 'object') return { ...DEFAULT_EDITOR_SETTINGS };
  const entry = value as Record<string, unknown>;
  return {
    fontSize: clampInt(
      entry.fontSize,
      EDITOR_FONT_SIZE_MIN,
      EDITOR_FONT_SIZE_MAX,
      DEFAULT_EDITOR_SETTINGS.fontSize,
    ),
    tabSize: oneOf(EDITOR_TAB_SIZES, entry.tabSize, DEFAULT_EDITOR_SETTINGS.tabSize),
    wordWrap:
      typeof entry.wordWrap === 'boolean' ? entry.wordWrap : DEFAULT_EDITOR_SETTINGS.wordWrap,
    autocomplete:
      typeof entry.autocomplete === 'boolean'
        ? entry.autocomplete
        : DEFAULT_EDITOR_SETTINGS.autocomplete,
    lineNumbers:
      typeof entry.lineNumbers === 'boolean'
        ? entry.lineNumbers
        : DEFAULT_EDITOR_SETTINGS.lineNumbers,
  };
};

const sanitizeReminders = (value: unknown): ReminderSettings => {
  if (!value || typeof value !== 'object') return { ...DEFAULT_REMINDER_SETTINGS };
  const entry = value as Record<string, unknown>;
  const quietHours = sanitizeQuietHours(entry.quietHours);
  return {
    enabled: typeof entry.enabled === 'boolean' ? entry.enabled : DEFAULT_REMINDER_SETTINGS.enabled,
    hour: clampInt(
      entry.hour,
      REMINDER_HOUR_MIN,
      REMINDER_HOUR_MAX,
      DEFAULT_REMINDER_SETTINGS.hour,
    ),
    minute: clampInt(
      entry.minute,
      REMINDER_MINUTE_MIN,
      REMINDER_MINUTE_MAX,
      DEFAULT_REMINDER_SETTINGS.minute,
    ),
    days: sanitizeReminderDays(entry.days),
    ...(quietHours ? { quietHours } : {}),
  };
};

const sanitize = (raw: unknown): AppSettings => {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };
  const value = raw as Record<string, unknown>;
  const weeklyGoalActiveDays = sanitizeWeeklyGoal(value.weeklyGoalActiveDays);
  return {
    accent: oneOf(ACCENT_IDS, value.accent, DEFAULT_SETTINGS.accent),
    reading: oneOf(READING_SIZES, value.reading, DEFAULT_SETTINGS.reading),
    readingFont: oneOf(READING_FONTS, value.readingFont, DEFAULT_SETTINGS.readingFont),
    readingSpacing: value.readingSpacing === 'relaxed' ? 'relaxed' : 'normal',
    readingWidth: oneOf(READING_WIDTHS, value.readingWidth, DEFAULT_SETTINGS.readingWidth),
    motion: value.motion === 'reduced' ? 'reduced' : 'system',
    themePreference: oneOf(
      THEME_PREFERENCES,
      value.themePreference,
      DEFAULT_SETTINGS.themePreference,
    ),
    contentLanguage: oneOf(
      CONTENT_LANGUAGES,
      value.contentLanguage,
      DEFAULT_SETTINGS.contentLanguage,
    ),
    density: oneOf(DENSITIES, value.density, DEFAULT_SETTINGS.density),
    contrast: oneOf(CONTRASTS, value.contrast, DEFAULT_SETTINGS.contrast),
    dailyGoal:
      typeof value.dailyGoal === 'number' ? clampGoal(value.dailyGoal) : DEFAULT_SETTINGS.dailyGoal,
    newCardsPerDay: clampInt(
      value.newCardsPerDay,
      NEW_CARDS_PER_DAY_MIN,
      NEW_CARDS_PER_DAY_MAX,
      DEFAULT_SETTINGS.newCardsPerDay,
    ),
    sessionLimit: oneOf(SESSION_LIMITS, value.sessionLimit, DEFAULT_SETTINGS.sessionLimit),
    targetRetention: oneOf(
      TARGET_RETENTIONS,
      value.targetRetention,
      DEFAULT_SETTINGS.targetRetention,
    ),
    ...(weeklyGoalActiveDays !== undefined ? { weeklyGoalActiveDays } : {}),
    challengeLevel: oneOf(CHALLENGE_LEVELS, value.challengeLevel, DEFAULT_SETTINGS.challengeLevel),
    editor: sanitizeEditor(value.editor),
    reminders: sanitizeReminders(value.reminders),
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
  if (settings.readingFont === 'serif') delete root.dataset.readingFont;
  else root.dataset.readingFont = settings.readingFont;
  if (settings.readingSpacing === 'relaxed') root.dataset.readingSpacing = 'relaxed';
  else delete root.dataset.readingSpacing;
  if (settings.readingWidth === 'default') delete root.dataset.readingWidth;
  else root.dataset.readingWidth = settings.readingWidth;
  if (settings.motion === 'reduced') root.dataset.motion = 'reduced';
  else delete root.dataset.motion;
  if (settings.density === 'compact') root.dataset.density = 'compact';
  else delete root.dataset.density;
  if (settings.contrast === 'high') root.dataset.contrast = 'high';
  else delete root.dataset.contrast;
  setThemePreference(settings.themePreference);
};

export const initSettings = (): void => {
  current = read();
  current = { ...current, themePreference: readThemePreference() };
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
  if (patch.dailyGoal !== undefined)
    current = { ...current, dailyGoal: clampGoal(current.dailyGoal) };
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

export type AppSettingsBackup = Pick<
  AppSettings,
  | 'accent'
  | 'themePreference'
  | 'contrast'
  | 'density'
  | 'motion'
  | 'contentLanguage'
  | 'reading'
  | 'readingFont'
  | 'readingSpacing'
  | 'readingWidth'
  | 'editor'
>;

export const exportableSettings = (): AppSettingsBackup => {
  const s = getSettings();
  return {
    accent: s.accent,
    themePreference: s.themePreference,
    contrast: s.contrast,
    density: s.density,
    motion: s.motion,
    contentLanguage: s.contentLanguage,
    reading: s.reading,
    readingFont: s.readingFont,
    readingSpacing: s.readingSpacing,
    readingWidth: s.readingWidth,
    editor: { ...s.editor },
  };
};

export const importSettings = (raw: unknown): boolean => {
  if (!raw || typeof raw !== 'object') return false;
  const value = raw as Record<string, unknown>;
  const patch: Partial<AppSettings> = {
    accent: oneOf(ACCENT_IDS, value.accent, current.accent),
    themePreference: oneOf(THEME_PREFERENCES, value.themePreference, current.themePreference),
    contrast: oneOf(CONTRASTS, value.contrast, current.contrast),
    density: oneOf(DENSITIES, value.density, current.density),
    motion: value.motion === 'reduced' ? 'reduced' : 'system',
    contentLanguage: oneOf(CONTENT_LANGUAGES, value.contentLanguage, current.contentLanguage),
    reading: oneOf(READING_SIZES, value.reading, current.reading),
    readingFont: oneOf(READING_FONTS, value.readingFont, current.readingFont),
    readingSpacing: value.readingSpacing === 'relaxed' ? 'relaxed' : 'normal',
    readingWidth: oneOf(READING_WIDTHS, value.readingWidth, current.readingWidth),
    editor: sanitizeEditor(value.editor),
  };
  setSettings(patch);
  return true;
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useSettings = (): AppSettings =>
  useSyncExternalStore(subscribe, getSettings, () => DEFAULT_SETTINGS);
