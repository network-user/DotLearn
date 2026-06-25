import { describe, expect, it } from 'vitest';

import { isSafeHref, sanitizeHref } from './safe-url';

describe('isSafeHref', () => {
  it('accepts same-page fragments and site-relative paths', () => {
    expect(isSafeHref('#section')).toBe(true);
    expect(isSafeHref('/topics/fastapi')).toBe(true);
  });

  it('accepts absolute http(s) and mailto URLs', () => {
    expect(isSafeHref('https://example.com/a')).toBe(true);
    expect(isSafeHref('http://example.com')).toBe(true);
    expect(isSafeHref('mailto:user@example.com')).toBe(true);
  });

  it('rejects empty, null and whitespace-only hrefs', () => {
    expect(isSafeHref(null)).toBe(false);
    expect(isSafeHref(undefined)).toBe(false);
    expect(isSafeHref('')).toBe(false);
    expect(isSafeHref('   ')).toBe(false);
  });

  it('rejects script-bearing and non-http schemes, including obfuscations', () => {
    expect(isSafeHref('javascript:alert(1)')).toBe(false);
    expect(isSafeHref('  javascript:alert(1)')).toBe(false);
    expect(isSafeHref('JavaScript:alert(1)')).toBe(false);
    expect(isSafeHref('vbscript:msgbox(1)')).toBe(false);
    expect(isSafeHref('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isSafeHref('blob:https://example.com/uuid')).toBe(false);
    expect(isSafeHref('file:///etc/passwd')).toBe(false);
  });

  it('rejects protocol-relative URLs that would resolve off-origin', () => {
    expect(isSafeHref('//evil.com')).toBe(false);
    expect(isSafeHref('//evil.com/path')).toBe(false);
  });
});

describe('sanitizeHref', () => {
  it('returns the href unchanged when it is safe', () => {
    expect(sanitizeHref('https://example.com')).toBe('https://example.com');
    expect(sanitizeHref('/path')).toBe('/path');
  });

  it('returns undefined when the href is unsafe', () => {
    expect(sanitizeHref('javascript:alert(1)')).toBeUndefined();
    expect(sanitizeHref('//evil.com')).toBeUndefined();
    expect(sanitizeHref(null)).toBeUndefined();
  });
});
