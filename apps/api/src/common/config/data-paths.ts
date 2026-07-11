import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

export const dataDir = (): string => resolve(process.cwd(), process.env.DATA_DIR ?? './data');

export const dataFile = (name: string): string => {
  if (name.length === 0 || /[/\\]|\.\.|\0/.test(name)) {
    throw new Error(`Unsafe data file name: ${JSON.stringify(name)}`);
  }
  return resolve(dataDir(), name);
};

export const ensureDataDir = async (): Promise<void> => {
  await mkdir(dataDir(), { recursive: true });
};

const SYNC_KEY_PATTERN = /^[0-9a-f]{64}$/;

export const syncDir = (): string => resolve(dataDir(), 'sync');

export const syncFile = (key: string): string => {
  if (!SYNC_KEY_PATTERN.test(key)) {
    throw new Error(`Unsafe sync key: ${JSON.stringify(key)}`);
  }
  return resolve(syncDir(), `${key}.json`);
};

export const ensureSyncDir = async (): Promise<void> => {
  await mkdir(syncDir(), { recursive: true });
};
