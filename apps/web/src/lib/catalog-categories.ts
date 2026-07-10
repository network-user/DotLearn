export type CatalogCategoryId =
  | 'foundations'
  | 'python-core'
  | 'frontend'
  | 'algorithms'
  | 'databases'
  | 'web-api'
  | 'architecture'
  | 'ml-ai'
  | 'tools'
  | 'other';

export const FALLBACK_CATEGORY: CatalogCategoryId = 'other';

export const CATALOG_CATEGORY_ORDER: readonly CatalogCategoryId[] = [
  'foundations',
  'python-core',
  'frontend',
  'algorithms',
  'databases',
  'web-api',
  'architecture',
  'ml-ai',
  'tools',
  'other',
];

const SLUG_TO_CATEGORY: Readonly<Record<string, CatalogCategoryId>> = {
  'python-basics': 'foundations',
  'regular-expressions': 'foundations',
  'javascript-basics': 'frontend',
  'html-css-basics': 'frontend',
  'http-fundamentals': 'web-api',
  'linux-command-line': 'tools',
  'data-structures': 'algorithms',
  'python-oop': 'python-core',
  'python-mro': 'python-core',
  'python-decorators': 'python-core',
  'python-context-managers': 'python-core',
  'python-storage-internals': 'python-core',
  'python-walrus': 'python-core',
  'python-main-guard': 'python-core',
  'python-typevar': 'python-core',
  'python-logging': 'python-core',
  'python-testing': 'python-core',
  'python-dataclasses': 'python-core',
  'python-iterators-generators': 'python-core',
  'python-concurrency': 'python-core',
  'python-algorithms': 'algorithms',
  'computational-complexity': 'algorithms',
  hashing: 'algorithms',
  'sql-fundamentals': 'databases',
  'db-indexes': 'databases',
  'database-types': 'databases',
  'db-scaling': 'databases',
  'python-orm': 'databases',
  fastapi: 'web-api',
  litestar: 'web-api',
  django: 'web-api',
  'django-drf': 'web-api',
  'django-query-profiling': 'web-api',
  cors: 'web-api',
  keycloak: 'web-api',
  'websockets-realtime': 'web-api',
  'dependency-injection': 'architecture',
  'clean-architecture': 'architecture',
  'message-brokers': 'architecture',
  celery: 'architecture',
  's3-storage': 'architecture',
  'neural-networks': 'ml-ai',
  'llm-foundations': 'ml-ai',
  'prompt-engineering': 'ml-ai',
  'yolo-detection': 'ml-ai',
  git: 'tools',
};

export const categoryOfSlug = (slug: string): CatalogCategoryId =>
  SLUG_TO_CATEGORY[slug] ?? FALLBACK_CATEGORY;

export const categoryLabelKey = (id: CatalogCategoryId): string => `categories.${id}`;

export interface CatalogGroup<T> {
  id: CatalogCategoryId;
  items: T[];
}

export const groupByCatalogCategory = <T>(
  items: readonly T[],
  slugOf: (item: T) => string,
): CatalogGroup<T>[] => {
  const buckets = new Map<CatalogCategoryId, T[]>();
  for (const item of items) {
    const id = categoryOfSlug(slugOf(item));
    const bucket = buckets.get(id);
    if (bucket) {
      bucket.push(item);
    } else {
      buckets.set(id, [item]);
    }
  }
  return CATALOG_CATEGORY_ORDER.flatMap((id) => {
    const bucket = buckets.get(id);
    return bucket && bucket.length > 0 ? [{ id, items: bucket }] : [];
  });
};
