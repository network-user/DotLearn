import catalogCategoriesData from './catalog-categories.data.json';

export type CatalogCategoryId =
  | 'foundations'
  | 'python-core'
  | 'frontend'
  | 'algorithms'
  | 'databases'
  | 'web-api'
  | 'architecture'
  | 'ml-ai'
  | 'onec'
  | 'tools'
  | 'other';

export const FALLBACK_CATEGORY: CatalogCategoryId = 'other';

export const CATALOG_CATEGORY_ORDER: readonly CatalogCategoryId[] =
  catalogCategoriesData.order as readonly CatalogCategoryId[];

const SLUG_TO_CATEGORY: Readonly<Record<string, CatalogCategoryId>> =
  catalogCategoriesData.slugToCategory as Readonly<Record<string, CatalogCategoryId>>;

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
