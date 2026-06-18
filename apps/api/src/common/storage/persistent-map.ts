import { Logger } from '@nestjs/common';

import { dataFile } from '../config/data-paths';
import { readJsonFile, writeJsonFile } from './json-file-store';

type Entry<V> = [string, V];

export class PersistentMap<V> {
  private readonly map = new Map<string, V>();
  private writeChain: Promise<void> = Promise.resolve();
  private enabled = false;
  private readonly logger: Logger;

  constructor(private readonly filename: string) {
    this.logger = new Logger(`PersistentMap:${filename}`);
  }

  async load(): Promise<void> {
    const entries = await readJsonFile<Entry<V>[]>(dataFile(this.filename), [], {
      onCorrupt: 'fail',
    });
    if (Array.isArray(entries)) {
      for (const entry of entries) {
        if (Array.isArray(entry) && entry.length === 2 && typeof entry[0] === 'string') {
          this.map.set(entry[0], entry[1]);
        }
      }
    }
    // Persistence is only armed once load() runs (i.e. inside onModuleInit). Unit tests that
    // construct a service without bootstrapping the module never touch the filesystem.
    this.enabled = true;
  }

  get(key: string): V | undefined {
    return this.map.get(key);
  }

  has(key: string): boolean {
    return this.map.has(key);
  }

  get size(): number {
    return this.map.size;
  }

  entries(): IterableIterator<Entry<V>> {
    return this.map.entries();
  }

  set(key: string, value: V): void {
    this.map.set(key, value);
    this.schedulePersist();
  }

  delete(key: string): boolean {
    const existed = this.map.delete(key);
    if (existed) {
      this.schedulePersist();
    }
    return existed;
  }

  private schedulePersist(): void {
    if (!this.enabled) return;
    const snapshot = [...this.map.entries()];
    this.writeChain = this.writeChain
      .then(() => writeJsonFile(dataFile(this.filename), snapshot))
      .catch((error) => {
        this.logger.error(
          { file: this.filename },
          `persistent_map_write_failed: durable state may be stale (${
            error instanceof Error ? error.message : String(error)
          })`,
        );
      });
  }
}
