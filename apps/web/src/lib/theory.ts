import { lazy, type ComponentType } from 'react';

interface TheoryModule {
  default: ComponentType<Record<string, unknown>>;
}

const theoryImporters = import.meta.glob<TheoryModule>('../../../../topics/*/theory/*.mdx');

const RELATIVE_PREFIX = '../../../../';

const normalize = (path: string): string =>
  path.startsWith(RELATIVE_PREFIX) ? `/${path.slice(RELATIVE_PREFIX.length)}` : path;

const PATH_PATTERN = /\/topics\/([a-z][a-z0-9-]*[a-z0-9])\/(theory\/[^/]+\.mdx)$/;

const indexed = new Map<string, Map<string, () => Promise<TheoryModule>>>();
for (const [rawPath, importer] of Object.entries(theoryImporters)) {
  const path = normalize(rawPath);
  const match = PATH_PATTERN.exec(path);
  if (!match) {
    continue;
  }
  const slug = match[1] as string;
  const filename = match[2] as string;
  const bucket = indexed.get(slug) ?? new Map<string, () => Promise<TheoryModule>>();
  bucket.set(filename, importer);
  indexed.set(slug, bucket);
}

export interface ResolvedTheory {
  filename: string;
  Component: ComponentType<Record<string, unknown>>;
}

const componentCache = new Map<string, ComponentType<Record<string, unknown>>>();

export const getTheory = (slug: string, filename: string): ResolvedTheory | undefined => {
  const importer = indexed.get(slug)?.get(filename);
  if (!importer) {
    return undefined;
  }
  const cacheKey = `${slug}/${filename}`;
  let Component = componentCache.get(cacheKey);
  if (!Component) {
    Component = lazy(importer);
    componentCache.set(cacheKey, Component);
  }
  return { filename, Component };
};
