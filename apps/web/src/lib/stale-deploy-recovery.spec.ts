import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { recoverFromStaleChunk } from './stale-deploy-recovery';

describe('recoverFromStaleChunk', () => {
  const reload = vi.fn();
  const unregister = vi.fn(() => Promise.resolve(true));
  const cacheDelete = vi.fn(() => Promise.resolve(true));

  beforeEach(() => {
    sessionStorage.clear();
    reload.mockClear();
    unregister.mockClear();
    cacheDelete.mockClear();
    vi.stubGlobal('location', { reload });
    vi.stubGlobal('navigator', {
      serviceWorker: {
        getRegistrations: () => Promise.resolve([{ unregister }]),
      },
    });
    vi.stubGlobal('caches', {
      keys: () => Promise.resolve(['precache-v1', 'runtime']),
      delete: cacheDelete,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('unregisters the service worker, clears every cache, then reloads', async () => {
    await recoverFromStaleChunk();
    expect(unregister).toHaveBeenCalledTimes(1);
    expect(cacheDelete).toHaveBeenCalledTimes(2);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('runs at most once per tab session without force', async () => {
    await recoverFromStaleChunk();
    await recoverFromStaleChunk();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('force bypasses the once-per-session guard', async () => {
    await recoverFromStaleChunk();
    await recoverFromStaleChunk({ force: true });
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('still reloads when the service worker and cache APIs are unavailable', async () => {
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('caches', undefined);
    await recoverFromStaleChunk();
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
