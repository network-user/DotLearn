import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { Plugin } from 'vite';

const VIRTUAL_ID = 'virtual:topic-manifests';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

type ManifestRecord = Record<string, unknown>;

export const topicManifestsPlugin = (): Plugin => {
  const topicsRoot = resolve(__dirname, '../../topics');

  return {
    name: 'dotlearn-topic-manifests',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    load(id) {
      if (id !== RESOLVED_ID) {
        return undefined;
      }
      const manifests: ManifestRecord = {};
      for (const topicEntry of readdirSync(topicsRoot, { withFileTypes: true })) {
        if (!topicEntry.isDirectory()) {
          continue;
        }
        const slug = topicEntry.name;
        const manifestPath = join(topicsRoot, slug, 'manifest.json');
        let raw: string;
        try {
          raw = readFileSync(manifestPath, 'utf8');
        } catch {
          continue;
        }
        this.addWatchFile(manifestPath);
        manifests[`/topics/${slug}/manifest.json`] = JSON.parse(raw);
      }
      return `export default ${JSON.stringify(manifests)};`;
    },
  };
};
