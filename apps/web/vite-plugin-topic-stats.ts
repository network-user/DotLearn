import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { Plugin } from 'vite';
import { parse as parseYaml } from 'yaml';

const VIRTUAL_ID = 'virtual:topic-stats';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

const LANGUAGE_SUFFIX = /\.(en|ru)\.yaml$/;

type TopicStats = Record<string, Record<string, number>>;

const countExercises = (filePath: string): number => {
  const parsed: unknown = parseYaml(readFileSync(filePath, 'utf8'));
  if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { exercises?: unknown }).exercises)) {
    return (parsed as { exercises: unknown[] }).exercises.length;
  }
  return 0;
};

export const topicStatsPlugin = (): Plugin => {
  const topicsRoot = resolve(__dirname, '../../topics');

  return {
    name: 'dotlearn-topic-stats',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : undefined;
    },
    load(id) {
      if (id !== RESOLVED_ID) {
        return undefined;
      }
      const stats: TopicStats = {};
      for (const topicEntry of readdirSync(topicsRoot, { withFileTypes: true })) {
        if (!topicEntry.isDirectory()) {
          continue;
        }
        const slug = topicEntry.name;
        const exercisesDir = join(topicsRoot, slug, 'exercises');
        let files: string[];
        try {
          files = readdirSync(exercisesDir);
        } catch {
          continue;
        }
        for (const file of files) {
          const match = LANGUAGE_SUFFIX.exec(file);
          if (!match) {
            continue;
          }
          const language = match[1] as string;
          const filePath = join(exercisesDir, file);
          this.addWatchFile(filePath);
          const bucket = stats[slug] ?? {};
          bucket[language] = (bucket[language] ?? 0) + countExercises(filePath);
          stats[slug] = bucket;
        }
      }
      return `export default ${JSON.stringify(stats)};`;
    },
  };
};
