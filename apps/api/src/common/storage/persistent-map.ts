import { dataFile } from '../config/data-paths';
import { readJsonFile, writeJsonFile } from './json-file-store';

type Entry<V> = [string, V];

export class PersistentMap<V> {
  private readonly map = new Map<string, V>();
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly filename: string) {}

  async load(): Promise<void> {
    const entries = await readJsonFile<Entry<V>[]>(dataFile(this.filename), []);
    if (!Array.isArray(entries)) return;
    for (const entry of entries) {
      if (Array.isArray(entry) && entry.length === 2 && typeof entry[0] === 'string') {
        this.map.set(entry[0], entry[1]);
      }
    }
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
    const snapshot = [...this.map.entries()];
    this.writeChain = this.writeChain
      .then(() => writeJsonFile(dataFile(this.filename), snapshot))
      .catch(() => undefined);
  }
}
