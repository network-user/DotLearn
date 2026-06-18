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
