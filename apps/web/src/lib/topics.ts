import { TopicManifest } from '@dotlearn/contracts';

type TopicManifestType = ReturnType<typeof TopicManifest.parse>;

type ManifestModule = { default: unknown };

const manifestModules = import.meta.glob<ManifestModule>('/topics/*/manifest.json', {
  eager: true,
});

const cache = new Map<string, TopicManifestType>();

for (const [path, mod] of Object.entries(manifestModules)) {
  const parsed = TopicManifest.safeParse(mod.default);
  if (!parsed.success) {
    console.warn(`[topics] invalid manifest at ${path}`, parsed.error.flatten());
    continue;
  }
  cache.set(parsed.data.slug, parsed.data);
}

export const listTopics = (): TopicManifestType[] =>
  [...cache.values()].sort((a, b) => a.title.localeCompare(b.title));

export const getTopic = (slug: string): TopicManifestType | undefined => cache.get(slug);
