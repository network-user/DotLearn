import { rm } from 'node:fs/promises';

import { Injectable } from '@nestjs/common';

import { dataFile, ensureSyncDir, syncFile } from '../../common/config/data-paths';
import { readJsonFile, writeJsonFile } from '../../common/storage/json-file-store';
import { PersistentMap } from '../../common/storage/persistent-map';

export interface SyncIndexEntry {
  rev: number;
  updatedAt: number;
  lastAccessAt: number;
  size: number;
  createdAt: number;
}

interface SyncBlobFile {
  rev: number;
  updatedAt: number;
  blob: string;
}

const isMissingFile = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === 'ENOENT';

const INDEX_FILE = 'sync-index.json';

// Metadata index only (<1 MB): the opaque blobs never live in RAM beyond a
// single request, they are read/written directly against data/sync/<key>.json.
@Injectable()
export class SyncStore {
  private readonly index = new PersistentMap<SyncIndexEntry>(INDEX_FILE);

  async load(): Promise<void> {
    await ensureSyncDir();
    await this.index.load();
  }

  get(key: string): SyncIndexEntry | undefined {
    return this.index.get(key);
  }

  has(key: string): boolean {
    return this.index.has(key);
  }

  get size(): number {
    return this.index.size;
  }

  entries(): IterableIterator<[string, SyncIndexEntry]> {
    return this.index.entries();
  }

  setEntry(key: string, entry: SyncIndexEntry): void {
    this.index.set(key, entry);
  }

  deleteEntry(key: string): boolean {
    return this.index.delete(key);
  }

  async readBlob(key: string): Promise<{ blob: string } | undefined> {
    const file = await readJsonFile<SyncBlobFile | null>(syncFile(key), null);
    return file ? { blob: file.blob } : undefined;
  }

  async writeBlob(key: string, rev: number, updatedAt: number, blob: string): Promise<void> {
    const payload: SyncBlobFile = { rev, updatedAt, blob };
    await writeJsonFile(syncFile(key), payload);
  }

  async deleteBlob(key: string): Promise<void> {
    try {
      await rm(syncFile(key), { force: true });
    } catch (error) {
      if (!isMissingFile(error)) throw error;
    }
  }

  // Wait for any fire-and-forget PersistentMap writes, then re-persist the
  // current in-memory index. Idempotent; used on shutdown and in tests before
  // tearing down the data directory.
  async flush(): Promise<void> {
    await this.index.whenIdle();
    const snapshot = [...this.index.entries()];
    await writeJsonFile(dataFile(INDEX_FILE), snapshot);
  }
}
