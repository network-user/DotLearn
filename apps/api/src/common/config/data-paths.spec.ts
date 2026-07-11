import { resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { dataDir, syncDir, syncFile } from './data-paths';

describe('syncDir', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('resolves to a "sync" subdirectory under the data dir', () => {
    vi.stubEnv('DATA_DIR', '/tmp/dotlearn-data-paths-test');
    expect(syncDir()).toBe(resolve(dataDir(), 'sync'));
  });
});

describe('syncFile', () => {
  const VALID_KEY = 'a'.repeat(64);

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('resolves a valid 64-hex key to a path inside syncDir', () => {
    vi.stubEnv('DATA_DIR', '/tmp/dotlearn-data-paths-test');
    expect(syncFile(VALID_KEY)).toBe(resolve(syncDir(), `${VALID_KEY}.json`));
  });

  it('throws on a key that is not lowercase hex', () => {
    expect(() => syncFile('A'.repeat(64))).toThrow(/Unsafe sync key/);
    expect(() => syncFile('g'.repeat(64))).toThrow(/Unsafe sync key/);
  });

  it('throws on a key of the wrong length', () => {
    expect(() => syncFile('a'.repeat(63))).toThrow(/Unsafe sync key/);
    expect(() => syncFile('a'.repeat(65))).toThrow(/Unsafe sync key/);
  });

  it('throws on a path traversal attempt', () => {
    expect(() => syncFile('../../etc/passwd')).toThrow(/Unsafe sync key/);
    expect(() => syncFile(`${'a'.repeat(60)}/../`)).toThrow(/Unsafe sync key/);
  });

  it('throws on an empty key', () => {
    expect(() => syncFile('')).toThrow(/Unsafe sync key/);
  });
});
