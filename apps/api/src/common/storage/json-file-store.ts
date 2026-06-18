import { randomUUID } from 'node:crypto';
import { open, readFile, rename } from 'node:fs/promises';

import { ensureDataDir } from '../config/data-paths';

const isMissingFile = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === 'ENOENT';

export type CorruptFilePolicy = 'quarantine-and-fallback' | 'fail';

export interface ReadJsonOptions {
  onCorrupt?: CorruptFilePolicy;
}

const quarantineCorruptFile = async (filePath: string): Promise<void> => {
  try {
    await rename(filePath, `${filePath}.corrupt.${Date.now()}`);
  } catch {
    /* best-effort: if the rename fails the fallback is still returned */
  }
};

export const readJsonFile = async <T>(
  filePath: string,
  fallback: T,
  options: ReadJsonOptions = {},
): Promise<T> => {
  let raw: string;
  try {
    raw = await readFile(filePath, 'utf8');
  } catch (error) {
    if (isMissingFile(error)) {
      return fallback;
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    if (options.onCorrupt === 'fail') {
      throw new Error(
        `Refusing to start: ${filePath} holds security-sensitive state but is corrupt. ` +
          'Restore it from a backup or remove it deliberately; auto-resetting it would ' +
          `silently undo prior revocations. Cause: ${(error as Error).message}`,
      );
    }
    await quarantineCorruptFile(filePath);
    return fallback;
  }

  if (Array.isArray(fallback) && !Array.isArray(parsed)) {
    if (options.onCorrupt === 'fail') {
      throw new Error(`Refusing to start: ${filePath} has an unexpected (non-array) shape.`);
    }
    await quarantineCorruptFile(filePath);
    return fallback;
  }

  return parsed as T;
};

export const writeJsonFile = async (filePath: string, payload: unknown): Promise<void> => {
  await ensureDataDir();
  const tmp = `${filePath}.${randomUUID()}.tmp`;
  const handle = await open(tmp, 'w');
  try {
    await handle.writeFile(`${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(tmp, filePath);
};
