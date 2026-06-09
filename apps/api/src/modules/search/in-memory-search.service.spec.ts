import { describe, expect, it } from 'vitest';

import { InMemorySearchService } from './in-memory-search.service';
import type { SearchDocument } from './search.service';

const fixture = (): SearchDocument[] => [
  {
    id: '1',
    title: 'SQL Window Functions',
    outline: 'Partition data and run aggregations within partitions.',
    tags: ['sql', 'databases'],
  },
  {
    id: '2',
    title: 'Django ORM deep dive',
    outline: 'Querysets, prefetch_related, select_related.',
    tags: ['python', 'django', 'orm'],
  },
  {
    id: '3',
    title: 'Pyodide in the browser',
    outline: 'Running Python in Web Workers with sandboxed APIs.',
    tags: ['python', 'pyodide', 'webworker'],
  },
];

const indexed = async (): Promise<InMemorySearchService> => {
  const service = new InMemorySearchService();
  await service.reindexAll(fixture());
  return service;
};

describe('InMemorySearchService', () => {
  it('returns no hits for an empty query', async () => {
    const service = await indexed();
    expect(await service.search('')).toEqual([]);
    expect(await service.search('   ')).toEqual([]);
  });

  it('matches an exact title token', async () => {
    const service = await indexed();
    const hits = await service.search('django');
    expect(hits[0]?.id).toBe('2');
  });

  it('matches a tag', async () => {
    const service = await indexed();
    const hits = await service.search('orm');
    expect(hits.map((hit) => hit.id)).toContain('2');
  });

  it('is typo-tolerant for short typos (pythn → python)', async () => {
    const service = await indexed();
    const hits = await service.search('pythn');
    const ids = hits.map((hit) => hit.id);
    expect(ids).toEqual(expect.arrayContaining(['2', '3']));
  });

  it('ranks titles above outline-only mentions', async () => {
    const service = await indexed();
    const hits = await service.search('python');
    expect(hits[0]?.id).toBeDefined();
    expect(hits.length).toBeGreaterThan(1);
    expect(hits[0]?.score).toBeGreaterThanOrEqual(hits[hits.length - 1]?.score ?? 0);
  });

  it('suggest() proposes titles by prefix', async () => {
    const service = await indexed();
    const suggestions = await service.suggest('pyo');
    expect(suggestions[0]?.title).toBe('Pyodide in the browser');
  });

  it('suggest() needs at least 2 characters', async () => {
    const service = await indexed();
    expect(await service.suggest('s')).toEqual([]);
  });

  it('upsert() makes a new document immediately searchable', async () => {
    const service = await indexed();
    await service.upsert({
      id: '4',
      title: 'GraphQL schema design',
      outline: 'Designing types and resolvers.',
      tags: ['graphql', 'api'],
    });
    const hits = await service.search('graphql');
    expect(hits[0]?.id).toBe('4');
  });

  it('remove() removes the document from search results', async () => {
    const service = await indexed();
    await service.remove('2');
    const hits = await service.search('django');
    expect(hits.map((hit) => hit.id)).not.toContain('2');
  });

  it('respects the limit argument', async () => {
    const service = await indexed();
    const hits = await service.search('python', 1);
    expect(hits.length).toBe(1);
  });
});
