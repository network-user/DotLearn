const SAFE_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

// True if the string contains an ASCII control character (C0 range or DEL). A smuggled
// NUL/tab/newline inside a scheme (e.g. "java\tscript:") parses inertly but is a content-hygiene
// red flag and breaks the link anyway, so such hrefs are rejected before URL parsing.
const hasControlChar = (value: string): boolean => {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
};

// Returns true only for hrefs that are safe to render as a clickable link: same-page fragments,
// site-relative paths, and absolute http(s)/mailto URLs. Rejects javascript:, data:, vbscript:,
// blob:, file: and any other scheme. Used as defense-in-depth for links whose href originates
// from topic content (MDX prose, manifest sources, image src) so a malicious/careless content
// PR cannot ship a script-bearing or phishing href even if it slips past review.
export const isSafeHref = (href: string | null | undefined): boolean => {
  if (!href) return false;
  const trimmed = href.trim();
  if (trimmed.length === 0) return false;
  if (hasControlChar(trimmed)) return false;
  if (trimmed.startsWith('//')) return false;
  if (trimmed.startsWith('#') || trimmed.startsWith('/')) return true;
  try {
    const base = typeof document !== 'undefined' ? document.baseURI : 'https://localhost/';
    return SAFE_SCHEMES.has(new URL(trimmed, base).protocol);
  } catch {
    return false;
  }
};

export const sanitizeHref = (href: string | null | undefined): string | undefined =>
  isSafeHref(href) ? (href as string) : undefined;
