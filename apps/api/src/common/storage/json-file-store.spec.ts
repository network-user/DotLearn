import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readJsonFile, writeJsonFile } from './json-file-store';

describe('json-file-store recovery', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'dotlearn-store-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns the fallback when the file is missing', async () => {
    const result = await readJsonFile(join(dir, 'missing.json'), { ok: true });
    expect(result).toEqual({ ok: true });
  });

  it('parses a valid file', async () => {
    const path = join(dir, 'valid.json');
    await writeFile(path, JSON.stringify([1, 2, 3]), 'utf8');
    expect(await readJsonFile<number[]>(path, [])).toEqual([1, 2, 3]);
  });

  it('quarantines a corrupt file and returns the fallback by default', async () => {
    const path = join(dir, 'corrupt.json');
    await writeFile(path, '{ not valid json', 'utf8');

    const result = await readJsonFile<number[]>(path, []);

    expect(result).toEqual([]);
    const entries = await readdir(dir);
    expect(entries.some((name) => name.startsWith('corrupt.json.corrupt.'))).toBe(true);
    expect(entries.includes('corrupt.json')).toBe(false);
  });

  it('refuses to fall back (throws) for security-sensitive state when onCorrupt is "fail"', async () => {
    const path = join(dir, 'revoked-tokens.json');
    await writeFile(path, 'definitely not json', 'utf8');

    await expect(readJsonFile(path, [], { onCorrupt: 'fail' })).rejects.toThrow(
      /Refusing to start/,
    );
  });

  it('treats a valid-but-non-array file as corrupt when an array fallback is expected', async () => {
    const path = join(dir, 'wrong-shape.json');
    await writeFile(path, JSON.stringify({ unexpected: 'object' }), 'utf8');

    expect(await readJsonFile<number[]>(path, [])).toEqual([]);
  });

  it('round-trips through the atomic writer', async () => {
    const path = join(dir, 'roundtrip.json');
    await writeJsonFile(path, [{ a: 1 }]);
    const raw = await readFile(path, 'utf8');
    expect(JSON.parse(raw)).toEqual([{ a: 1 }]);
  });
});
