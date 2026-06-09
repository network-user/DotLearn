import {
  languageOfTopicFile,
  type TopicLanguage,
  type TopicManifest,
} from '@dotlearn/contracts';
import {
  createLazyTopicSource,
  parseManifest,
  type ConceptBundle,
  type TopicBundle,
  type TopicSource,
} from '@dotlearn/lesson-engine';

import { listHiddenTopics } from './api-client';

const manifestModules = import.meta.glob<{ default: unknown }>(
  '../../../../topics/*/manifest.json',
  { eager: true },
);

const exerciseModules = import.meta.glob<string>(
  '../../../../topics/*/exercises/*.yaml',
  { query: '?raw', import: 'default' },
);

const RELATIVE_PREFIX = '../../../../';

const normalize = (path: string): string =>
  path.startsWith(RELATIVE_PREFIX) ? `/${path.slice(RELATIVE_PREFIX.length)}` : path;

const reKey = <T>(record: Record<string, T>): Record<string, T> => {
  const out: Record<string, T> = {};
  for (const [path, value] of Object.entries(record)) {
    out[normalize(path)] = value;
  }
  return out;
};

const manifests = reKey(
  Object.fromEntries(
    Object.entries(manifestModules).map(([path, mod]) => [path, mod.default]),
  ),
);
const exercises = reKey(exerciseModules);

const source: TopicSource = createLazyTopicSource({ manifests, exercises });

const rawCache = new Map<string, Promise<TopicBundle>>();
const cache = new Map<string, TopicBundle>();
const parsedManifests = new Map<string, TopicManifest>();
let cachedSlugs: string[] | undefined;

const manifestOf = (slug: string): TopicManifest | undefined => {
  const cached = parsedManifests.get(slug);
  if (cached) return cached;
  const raw = manifests[`/topics/${slug}/manifest.json`];
  if (raw === undefined) return undefined;
  const parsed = parseManifest(slug, raw);
  parsedManifests.set(slug, parsed);
  return parsed;
};

export const topicTitleOf = (slug: string): string | undefined => {
  const manifest = manifests[`/topics/${slug}/manifest.json`] as { title?: unknown } | undefined;
  return typeof manifest?.title === 'string' ? manifest.title : undefined;
};

export const listTopicSlugs = async (): Promise<string[]> => {
  if (!cachedSlugs) {
    cachedSlugs = await source.list();
  }
  return cachedSlugs;
};

export const effectiveLanguage = (
  manifest: TopicManifest,
  requested: TopicLanguage,
): TopicLanguage =>
  manifest.availableLanguages.includes(requested) ? requested : manifest.primaryLanguage;

const filterConceptByLanguage = (
  concept: ConceptBundle,
  language: TopicLanguage,
): ConceptBundle => ({
  conceptId: concept.conceptId,
  theory: concept.theory.filter((file) => languageOfTopicFile(file.filename) === language),
  exercises: concept.exercises.filter(
    (file) => languageOfTopicFile(file.filename) === language,
  ),
});

const filterBundleByLanguage = (
  bundle: TopicBundle,
  language: TopicLanguage,
): TopicBundle => ({
  manifest: bundle.manifest,
  concepts: bundle.concepts.map((concept) => filterConceptByLanguage(concept, language)),
});

const loadRawBundle = (slug: string): Promise<TopicBundle> => {
  const cached = rawCache.get(slug);
  if (cached) return cached;
  const pending = source.load(slug);
  rawCache.set(slug, pending);
  pending.catch(() => {
    rawCache.delete(slug);
  });
  return pending;
};

export const prefetchTopic = (slug: string): void => {
  void loadRawBundle(slug).catch(() => undefined);
};

export const loadTopic = async (
  slug: string,
  language: TopicLanguage,
): Promise<TopicBundle> => {
  const raw = await loadRawBundle(slug);
  const lang = effectiveLanguage(raw.manifest, language);
  const cacheKey = `${slug}::${lang}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const filtered = filterBundleByLanguage(raw, lang);
  cache.set(cacheKey, filtered);
  return filtered;
};

let manifestList: TopicManifest[] | undefined;
let hiddenSlugsPromise: Promise<Set<string>> | undefined;

const loadHiddenSlugs = async (): Promise<Set<string>> => {
  if (!hiddenSlugsPromise) {
    hiddenSlugsPromise = listHiddenTopics()
      .then((items) => new Set(items.map((item) => item.slug)))
      .catch(() => new Set<string>());
  }
  return hiddenSlugsPromise;
};

export const invalidateHiddenTopicsCache = (): void => {
  hiddenSlugsPromise = undefined;
  manifestList = undefined;
};

export const listManifests = async (): Promise<TopicManifest[]> => {
  if (manifestList) {
    return manifestList;
  }
  const [slugs, hidden] = await Promise.all([listTopicSlugs(), loadHiddenSlugs()]);
  manifestList = slugs
    .map((slug) => manifestOf(slug))
    .filter((manifest): manifest is TopicManifest => manifest !== undefined)
    .filter((manifest) => !hidden.has(manifest.slug))
    .sort((a, b) => a.title.localeCompare(b.title));
  return manifestList;
};

export const listAllManifestsIgnoringHidden = async (): Promise<TopicManifest[]> => {
  const slugs = await listTopicSlugs();
  return slugs
    .map((slug) => manifestOf(slug))
    .filter((manifest): manifest is TopicManifest => manifest !== undefined)
    .sort((a, b) => a.title.localeCompare(b.title));
};
