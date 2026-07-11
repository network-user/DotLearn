// Shared build-time SEO helpers. Pure Node (no Vite), reused by the prerenderer
// and the next wave (sitemap / llms.txt / markdown mirrors). Keep dependency-free
// beyond `yaml`, which apps/web already depends on.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';

const here = dirname(fileURLToPath(import.meta.url));

export const WEB_ROOT = resolve(here, '..');
export const REPO_ROOT = resolve(here, '..', '..', '..');
export const TOPICS_ROOT = resolve(REPO_ROOT, 'topics');
export const DIST_ROOT = resolve(WEB_ROOT, 'dist');
export const LOCALES_ROOT = resolve(WEB_ROOT, 'src', 'locales');

/** All topic manifests on disk, sorted by slug. Skips non-dirs and dirs without a manifest. */
export const loadTopics = () => {
  const topics = [];
  for (const entry of readdirSync(TOPICS_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(TOPICS_ROOT, entry.name);
    const manifestPath = join(dir, 'manifest.json');
    if (!existsSync(manifestPath)) continue;
    let manifest;
    try {
      manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch {
      continue;
    }
    if (!manifest || typeof manifest.slug !== 'string') continue;
    topics.push({ slug: manifest.slug, dir, manifest });
  }
  topics.sort((a, b) => a.slug.localeCompare(b.slug));
  return topics;
};

/** Canonical site origin, no trailing slash. */
export const resolveSiteUrl = () => {
  const raw = process.env.VITE_SITE_URL || process.env.VITE_API_BASE || 'http://localhost:4173';
  return String(raw).replace(/\/+$/, '');
};

/**
 * hreflang alternates for a ru/en path pair. Emits ru + en + x-default (= ru URL)
 * only when an en counterpart exists; otherwise no alternates. Shared by head and
 * the future sitemap generator.
 */
export const alternatesFor = (siteUrl, pair) => {
  if (!pair || typeof pair.ru !== 'string' || typeof pair.en !== 'string' || pair.en === '') {
    return [];
  }
  return [
    { hreflang: 'ru', href: siteUrl + pair.ru },
    { hreflang: 'en', href: siteUrl + pair.en },
    { hreflang: 'x-default', href: siteUrl + pair.ru },
  ];
};

/** 90 → "PT1H30M", 14 → "PT14M", 0 → "PT0M". */
export const minutesToISO8601 = (totalMinutes) => {
  const total = Math.max(0, Math.round(Number(totalMinutes) || 0));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  let out = 'PT';
  if (hours > 0) out += `${hours}H`;
  if (minutes > 0 || hours === 0) out += `${minutes}M`;
  return out;
};

/** 2.5 → "PT2H30M", 2.22 → "PT2H13M". */
export const hoursToISO8601 = (hours) => minutesToISO8601((Number(hours) || 0) * 60);

export const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export const escapeAttr = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** Port of packages/lesson-engine theory-lint frontmatter parser (fs-only). */
export const parseTheoryFrontmatter = (source) => {
  const match = FRONTMATTER_PATTERN.exec(source);
  if (!match) {
    return {
      conceptId: undefined,
      title: undefined,
      estimatedMinutes: undefined,
      body: source,
      found: false,
    };
  }
  let parsed;
  try {
    parsed = parseYaml(match[1] ?? '');
  } catch {
    parsed = undefined;
  }
  const result = { conceptId: undefined, title: undefined, estimatedMinutes: undefined };
  if (parsed && typeof parsed === 'object') {
    if (typeof parsed.conceptId === 'string') result.conceptId = parsed.conceptId;
    if (typeof parsed.title === 'string') result.title = parsed.title;
    if (typeof parsed.estimatedMinutes === 'number')
      result.estimatedMinutes = parsed.estimatedMinutes;
  }
  return { ...result, body: source.slice(match[0].length), found: true };
};

/** "theory/01-vcs-model.ru.mdx" → "01-vcs-model". */
export const theoryStem = (relPath) => basename(relPath).replace(/\.(ru|en)\.mdx$/, '');

/** Ordered theory file paths (relative to topic dir) for a concept in a language. */
export const theoryFilesFor = (manifest, conceptOrId, lang) => {
  const concept =
    typeof conceptOrId === 'string'
      ? (manifest.concepts ?? []).find((c) => c && c.id === conceptOrId)
      : conceptOrId;
  if (!concept || !Array.isArray(concept.theoryFiles)) return [];
  const suffix = `.${lang}.mdx`;
  return concept.theoryFiles.filter((f) => typeof f === 'string' && f.endsWith(suffix));
};

const theoryCache = new Map();

/** Read + parse a theory file once; returns { frontmatter, body, abs }. */
export const loadTheoryFile = (dir, relPath) => {
  const abs = join(dir, relPath);
  let entry = theoryCache.get(abs);
  if (!entry) {
    const parsed = parseTheoryFrontmatter(readFileSync(abs, 'utf8'));
    entry = {
      frontmatter: {
        conceptId: parsed.conceptId,
        title: parsed.title,
        estimatedMinutes: parsed.estimatedMinutes,
      },
      body: parsed.body,
    };
    theoryCache.set(abs, entry);
  }
  return { ...entry, abs };
};

export const topicHasEn = (topic) =>
  Array.isArray(topic.manifest.availableLanguages) &&
  topic.manifest.availableLanguages.includes('en');

/**
 * Display title of a concept in a given language.
 * ru → manifest concept title. en → frontmatter title of the concept's primary
 * en theory file (matched by stem to the ru file whose frontmatter title equals
 * the manifest title), with graceful fallbacks.
 */
export const conceptTitleFor = (topic, concept, lang) => {
  if (lang !== 'en') return concept.title;
  const ruFiles = theoryFilesFor(topic.manifest, concept, 'ru');
  const enFiles = theoryFilesFor(topic.manifest, concept, 'en');
  let primaryStem = null;
  for (const rel of ruFiles) {
    const { frontmatter } = loadTheoryFile(topic.dir, rel);
    if (frontmatter.title && frontmatter.title === concept.title) {
      primaryStem = theoryStem(rel);
      break;
    }
  }
  if (primaryStem) {
    const enRel = enFiles.find((rel) => theoryStem(rel) === primaryStem);
    if (enRel) {
      const { frontmatter } = loadTheoryFile(topic.dir, enRel);
      if (frontmatter.title) return frontmatter.title;
    }
  }
  for (let i = enFiles.length - 1; i >= 0; i -= 1) {
    const { frontmatter } = loadTheoryFile(topic.dir, enFiles[i]);
    if (frontmatter.title) return frontmatter.title;
  }
  return concept.title;
};

export const loadLocale = (lang) => {
  try {
    return JSON.parse(readFileSync(join(LOCALES_ROOT, `${lang}.json`), 'utf8'));
  } catch {
    return {};
  }
};
