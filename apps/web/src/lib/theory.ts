import type { ComponentType } from 'react';

interface TheoryModule {
  default: ComponentType<Record<string, unknown>>;
  frontmatter?: Record<string, unknown>;
}

const theoryModules = import.meta.glob<TheoryModule>(
  '../../../../topics/*/theory/*.mdx',
  { eager: true },
);

const RELATIVE_PREFIX = '../../../../';

const normalize = (path: string): string =>
  path.startsWith(RELATIVE_PREFIX) ? `/${path.slice(RELATIVE_PREFIX.length)}` : path;

const PATH_PATTERN = /\/topics\/([a-z][a-z0-9-]*[a-z0-9])\/(theory\/[^/]+\.mdx)$/;

const indexed = new Map<string, Map<string, TheoryModule>>();
for (const [rawPath, mod] of Object.entries(theoryModules)) {
  const path = normalize(rawPath);
  const match = PATH_PATTERN.exec(path);
  if (!match) {
    continue;
  }
  const slug = match[1] as string;
  const filename = match[2] as string;
  const bucket = indexed.get(slug) ?? new Map<string, TheoryModule>();
  bucket.set(filename, mod);
  indexed.set(slug, bucket);
}

export interface ResolvedTheory {
  filename: string;
  Component: ComponentType<Record<string, unknown>>;
  frontmatter?: Record<string, unknown>;
}

export const getTheory = (slug: string, filename: string): ResolvedTheory | undefined => {
  const bucket = indexed.get(slug);
  if (!bucket) {
    return undefined;
  }
  const mod = bucket.get(filename);
  if (!mod) {
    return undefined;
  }
  return mod.frontmatter !== undefined
    ? { filename, Component: mod.default, frontmatter: mod.frontmatter }
    : { filename, Component: mod.default };
};
