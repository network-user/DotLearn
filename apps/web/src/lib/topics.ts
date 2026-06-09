import type { TopicManifest } from '@dotlearn/contracts';
import {
  createBrowserTopicSource,
  type TopicBundle,
  type TopicSource,
} from '@dotlearn/lesson-engine';

const manifestModules = import.meta.glob<{ default: unknown }>(
  '../../../../topics/*/manifest.json',
  { eager: true },
);

const exerciseModules = import.meta.glob<string>(
  '../../../../topics/*/exercises/*.yaml',
  { eager: true, query: '?raw', import: 'default' },
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

const source: TopicSource = createBrowserTopicSource({ manifests, exercises });

const cache = new Map<string, TopicBundle>();
let cachedSlugs: string[] | undefined;

export const listTopicSlugs = async (): Promise<string[]> => {
  if (!cachedSlugs) {
    cachedSlugs = await source.list();
  }
  return cachedSlugs;
};

export const loadTopic = async (slug: string): Promise<TopicBundle> => {
  const cached = cache.get(slug);
  if (cached) {
    return cached;
  }
  const bundle = await source.load(slug);
  cache.set(slug, bundle);
  return bundle;
};

let manifestList: TopicManifest[] | undefined;

export const listManifests = async (): Promise<TopicManifest[]> => {
  if (manifestList) {
    return manifestList;
  }
  const slugs = await listTopicSlugs();
  const bundles = await Promise.all(slugs.map((slug) => loadTopic(slug)));
  manifestList = bundles
    .map((bundle) => bundle.manifest)
    .sort((a, b) => a.title.localeCompare(b.title));
  return manifestList;
};

