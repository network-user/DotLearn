import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SyncService } from './sync.service';
import { SyncStore } from './sync.store';

const UNKNOWN_CODE = '0123456789AB';

describe('SyncService', () => {
  const dirs: string[] = [];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    // PersistentMap.set()/delete() fire-and-forget their write onto an internal
    // chain (see common/storage/persistent-map.ts): it is not awaited by the
    // service calls above, so give pending writes a moment to settle on real
    // disk I/O before the temp dir is removed, or rm() can race a rename into
    // it (ENOENT) or see a stray .tmp file reappear mid-delete (ENOTEMPTY).
    await new Promise((resolve) => setTimeout(resolve, 100));
    await Promise.all(dirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  const createService = async (
    env: Record<string, string> = {},
  ): Promise<{ service: SyncService; store: SyncStore }> => {
    const dir = await mkdtemp(join(tmpdir(), 'dotlearn-sync-test-'));
    dirs.push(dir);
    vi.stubEnv('DATA_DIR', dir);
    for (const [key, value] of Object.entries(env)) {
      vi.stubEnv(key, value);
    }
    const store = new SyncStore();
    const service = new SyncService(store);
    await service.onModuleInit();
    return { service, store };
  };

  it('create() returns a fresh code and rev 0', async () => {
    const { service } = await createService();
    const result = await service.create();
    expect(result.rev).toBe(0);
    expect(result.code).toMatch(/^[0-9A-HJKMNP-TV-Z]{12}$/);
  });

  it('link() on a freshly created code returns rev 0 and refreshes lastAccessAt', async () => {
    const { service } = await createService();
    const { code } = await service.create();
    await expect(service.link(code)).resolves.toEqual({
      rev: 0,
      updatedAt: expect.any(Number),
      size: 0,
    });
  });

  it('pull() of a fresh code reports unchanged at rev 0 without a blob', async () => {
    const { service } = await createService();
    const { code } = await service.create();
    await expect(service.pull(code)).resolves.toEqual({ changed: false, rev: 0 });
  });

  it('push() increments rev and persists a blob readable by pull()', async () => {
    const { service } = await createService();
    const { code } = await service.create();

    const pushed = await service.push(code, 0, 'aGVsbG8=');
    expect(pushed.rev).toBe(1);

    const pulled = await service.pull(code, 0);
    expect(pulled).toMatchObject({ changed: true, rev: 1, blob: 'aGVsbG8=' });
  });

  it('pull() with sinceRev equal to the current rev reports unchanged without a blob', async () => {
    const { service } = await createService();
    const { code } = await service.create();
    await service.push(code, 0, 'aGVsbG8=');
    await expect(service.pull(code, 1)).resolves.toEqual({ changed: false, rev: 1 });
  });

  it('push() with a stale baseRev throws a conflict carrying the current rev', async () => {
    const { service } = await createService();
    const { code } = await service.create();
    await service.push(code, 0, 'aGVsbG8=');

    try {
      await service.push(code, 0, 'd29ybGQ=');
      expect.unreachable('expected a ConflictException');
    } catch (error) {
      expect(error).toBeInstanceOf(ConflictException);
      expect((error as ConflictException).getResponse()).toEqual({
        code: 'REV_CONFLICT',
        currentRev: 1,
      });
    }
  });

  it('link/pull/push on an unknown code all throw NotFoundException', async () => {
    const { service } = await createService();
    await expect(service.link(UNKNOWN_CODE)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.pull(UNKNOWN_CODE)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.push(UNKNOWN_CODE, 0, 'aGVsbG8=')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('push() rejects a decoded blob larger than SYNC_MAX_BLOB_BYTES', async () => {
    const { service } = await createService({ SYNC_MAX_BLOB_BYTES: '4' });
    const { code } = await service.create();
    // 'aGVsbG8=' decodes to 'hello' (5 bytes) > the 4-byte cap.
    await expect(service.push(code, 0, 'aGVsbG8=')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create() throws ServiceUnavailableException once SYNC_MAX_CODES is reached and GC frees nothing', async () => {
    const { service } = await createService({ SYNC_MAX_CODES: '1' });
    await service.create();
    await expect(service.create()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('remove() is idempotent and deletes the blob and index entry', async () => {
    const { service } = await createService();
    const { code } = await service.create();
    await service.push(code, 0, 'aGVsbG8=');

    await expect(service.remove(code)).resolves.toEqual({ deleted: true });
    await expect(service.remove(code)).resolves.toEqual({ deleted: true });
    await expect(service.link(code)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove() on a code that was never created still reports {deleted:true}', async () => {
    const { service } = await createService();
    await expect(service.remove(UNKNOWN_CODE)).resolves.toEqual({ deleted: true });
  });

  it('the hourly GC evicts a code idle past SYNC_TTL_DAYS, but a pull refresh saves it', async () => {
    const { service } = await createService({ SYNC_TTL_DAYS: '1' });
    const { code: idleCode } = await service.create();
    const { code: activeCode } = await service.create();

    // Halfway through the TTL window: touch only the active code.
    await vi.advanceTimersByTimeAsync(12 * 60 * 60_000);
    await service.pull(activeCode);

    // Cross the 1-day mark; the hourly sweep should have evicted idleCode but
    // spared activeCode, whose lastAccessAt was refreshed by the pull above.
    await vi.advanceTimersByTimeAsync(13 * 60 * 60_000);

    await expect(service.link(idleCode)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.link(activeCode)).resolves.toBeDefined();
  });

  it('throttles the lastAccessAt bump: a no-op pull inside the window skips the index write, one past it performs it', async () => {
    const { service, store } = await createService();
    const { code } = await service.create();

    const setEntry = vi.spyOn(store, 'setEntry');

    // create() just set lastAccessAt, so a poll seconds later is pure GC noise: no
    // index entry is rewritten and no persist is scheduled.
    await service.pull(code);
    expect(setEntry).not.toHaveBeenCalled();

    // Past the 10-minute bump window the same no-op poll refreshes lastAccessAt
    // with a single index write.
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    await service.pull(code);
    expect(setEntry).toHaveBeenCalledTimes(1);
  });
});
