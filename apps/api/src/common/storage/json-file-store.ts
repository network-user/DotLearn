import { randomUUID } from 'node:crypto';
import { readFile, rename, writeFile } from 'node:fs/promises';

import { ensureDataDir } from '../config/data-paths';

const isMissingFile = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === 'ENOENT';

export const readJsonFile = async <T>(filePath: string, fallback: T): Promise<T> => {
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch (error) {
    if (isMissingFile(error)) {
      return fallback;
    }
    throw error;
  }
};

export const writeJsonFile = async (filePath: string, payload: unknown): Promise<void> => {
  await ensureDataDir();
  const tmp = `${filePath}.${randomUUID()}.tmp`;
  await writeFile(tmp, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await rename(tmp, filePath);
};
