import { useSyncExternalStore } from 'react';

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
import i18n, { getCurrentLanguage } from './i18n';
import { getSettings, useSettings } from './settings';
import manifestRecord from 'virtual:topic-manifests';

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

const manifests: Record<string, unknown> = manifestRecord;
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

export const resolveContentLanguage = (): TopicLanguage => {
  const { contentLanguage } = getSettings();
  return contentLanguage === 'follow-ui' ? getCurrentLanguage() : contentLanguage;
};

const subscribeToLocale = (listener: () => void): (() => void) => {
  i18n.on('languageChanged', listener);
  return () => {
    i18n.off('languageChanged', listener);
  };
};

export const useContentLanguage = (): TopicLanguage => {
  const { contentLanguage } = useSettings();
  const locale = useSyncExternalStore<TopicLanguage>(
    subscribeToLocale,
    () => getCurrentLanguage(),
    () => 'ru',
  );
  return contentLanguage === 'follow-ui' ? locale : contentLanguage;
};

export const effectiveLanguage = (
  manifest: TopicManifest,
  requested: TopicLanguage = resolveContentLanguage(),
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

const loadRawBundle = (slug: string, language?: TopicLanguage): Promise<TopicBundle> => {
  const cacheKey = language ? `${slug}::${language}` : slug;
  const cached = rawCache.get(cacheKey);
  if (cached) return cached;
  const pending = source.load(slug, language ? { languages: [language] } : undefined);
  rawCache.set(cacheKey, pending);
  pending.catch(() => {
    rawCache.delete(cacheKey);
  });
  return pending;
};

export const prefetchTopic = (slug: string): void => {
  let language: TopicLanguage | undefined;
  try {
    const manifest = manifestOf(slug);
    language = manifest ? effectiveLanguage(manifest, resolveContentLanguage()) : undefined;
  } catch {
    language = undefined;
  }
  void loadRawBundle(slug, language).catch(() => undefined);
};

export const loadTopic = async (
  slug: string,
  language: TopicLanguage,
): Promise<TopicBundle> => {
  const manifest = manifestOf(slug);
  if (!manifest) {
    return loadRawBundle(slug);
  }
  const lang = effectiveLanguage(manifest, language);
  const cacheKey = `${slug}::${lang}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const raw = await loadRawBundle(slug, lang);
  const filtered = filterBundleByLanguage(raw, lang);
  cache.set(cacheKey, filtered);
  return filtered;
};

const slugFromManifestPath = (path: string): string | undefined =>
  /^\/topics\/([^/]+)\/manifest\.json$/.exec(path)?.[1];

let allManifestsCache: TopicManifest[] | undefined;

export const getAllManifests = (): TopicManifest[] => {
  if (allManifestsCache) {
    return allManifestsCache;
  }
  allManifestsCache = Object.keys(manifests)
    .map((path) => slugFromManifestPath(path))
    .filter((slug): slug is string => slug !== undefined)
    .map((slug) => manifestOf(slug))
    .filter((manifest): manifest is TopicManifest => manifest !== undefined)
    .sort((a, b) => a.title.localeCompare(b.title));
  return allManifestsCache;
};

let hiddenSlugsPromise: Promise<Set<string>> | undefined;
let hiddenSlugsCache: Set<string> | undefined;

export const loadHiddenSlugs = async (): Promise<Set<string>> => {
  if (!hiddenSlugsPromise) {
    hiddenSlugsPromise = listHiddenTopics()
      .then((items) => {
        hiddenSlugsCache = new Set(items.map((item) => item.slug));
        return hiddenSlugsCache;
      })
      .catch(() => {
        hiddenSlugsCache = new Set<string>();
        return hiddenSlugsCache;
      });
  }
  return hiddenSlugsPromise;
};

export const invalidateHiddenTopicsCache = (): void => {
  hiddenSlugsPromise = undefined;
  hiddenSlugsCache = undefined;
};

export const listManifests = async (): Promise<TopicManifest[]> => {
  const all = getAllManifests();
  void loadHiddenSlugs();
  const hidden = hiddenSlugsCache;
  return hidden && hidden.size > 0
    ? all.filter((manifest) => !hidden.has(manifest.slug))
    : all;
};

export const listAllManifestsIgnoringHidden = async (): Promise<TopicManifest[]> =>
  getAllManifests();
