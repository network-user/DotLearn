import { describe, expect, it } from 'vitest';

import { localizedPathForLanguage, routeLanguageFromPathname } from './localized-routes';

describe('routeLanguageFromPathname', () => {
  it('maps localized routes to their URL language', () => {
    expect(routeLanguageFromPathname('/')).toBe('ru');
    expect(routeLanguageFromPathname('/en')).toBe('en');
    expect(routeLanguageFromPathname('/topics/sql-basics')).toBe('ru');
    expect(routeLanguageFromPathname('/en/topics/sql-basics')).toBe('en');
    expect(routeLanguageFromPathname('/glossary')).toBe('ru');
    expect(routeLanguageFromPathname('/en/glossary')).toBe('en');
    expect(routeLanguageFromPathname('/interview/42')).toBe('ru');
    expect(routeLanguageFromPathname('/en/interview/42')).toBe('en');
  });

  it('returns undefined for UI-only routes', () => {
    expect(routeLanguageFromPathname('/settings')).toBeUndefined();
    expect(routeLanguageFromPathname('/progress')).toBeUndefined();
  });
});

describe('localizedPathForLanguage', () => {
  it('switches between ru and en localized paths', () => {
    expect(localizedPathForLanguage('/', 'en')).toBe('/en');
    expect(localizedPathForLanguage('/en', 'ru')).toBe('/');
    expect(localizedPathForLanguage('/glossary', 'en')).toBe('/en/glossary');
    expect(localizedPathForLanguage('/en/glossary', 'ru')).toBe('/glossary');
    expect(localizedPathForLanguage('/analytics', 'en')).toBe('/en/analytics');
    expect(localizedPathForLanguage('/en/analytics', 'ru')).toBe('/analytics');
    expect(localizedPathForLanguage('/topics/sql-basics', 'en')).toBe('/en/topics/sql-basics');
    expect(localizedPathForLanguage('/en/topics/sql-basics', 'ru')).toBe('/topics/sql-basics');
    expect(localizedPathForLanguage('/interview/7', 'en')).toBe('/en/interview/7');
    expect(localizedPathForLanguage('/en/interview/7', 'ru')).toBe('/interview/7');
  });

  it('returns undefined when already on the target locale', () => {
    expect(localizedPathForLanguage('/en', 'en')).toBeUndefined();
    expect(localizedPathForLanguage('/settings', 'ru')).toBeUndefined();
    expect(localizedPathForLanguage('/settings', 'en')).toBeUndefined();
  });
});
