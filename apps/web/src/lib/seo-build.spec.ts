import { describe, expect, it } from 'vitest';

// Build scripts are plain Node ESM; no package types for the suite.
// @ts-expect-error — untyped build script
import { toSitemapDate, latestMtimeIso } from '../../scripts/seo-lib.mjs';
// @ts-expect-error — untyped build script
import { buildRobots } from '../../scripts/seo-artifacts.mjs';

describe('seo-lib sitemap dates', () => {
  it('formats Date as YYYY-MM-DD', () => {
    expect(toSitemapDate(new Date('2026-03-15T12:00:00.000Z'))).toBe('2026-03-15');
  });

  it('returns undefined for invalid dates', () => {
    expect(toSitemapDate('not-a-date')).toBeUndefined();
  });

  it('latestMtimeIso returns undefined for empty list', () => {
    expect(latestMtimeIso([])).toBeUndefined();
  });
});

describe('buildRobots', () => {
  it('disallows private UI and admin path, allows AI bots, points to sitemap', () => {
    const text = buildRobots('https://example.com', { adminPath: '/secret-admin' });
    expect(text).toContain('Disallow: /search');
    expect(text).toContain('Disallow: /library');
    expect(text).toContain('Disallow: /analytics');
    expect(text).toContain('Disallow: /secret-admin');
    expect(text).toContain('User-agent: GPTBot');
    expect(text).toContain('Allow: /');
    expect(text).toContain('Sitemap: https://example.com/sitemap.xml');
  });

  it('defaults admin path to /admin', () => {
    const text = buildRobots('https://example.com', { adminPath: undefined });
    expect(text).toContain('Disallow: /admin');
  });
});
