/**
 * @vitest-environment node
 *
 * Exercises the blob codec end to end. Runs under node (not jsdom) so CompressionStream and
 * WebCrypto are the real platform implementations.
 */
import { describe, expect, it } from 'vitest';

import { decodeSnapshot, decodeSyncBlob, encodeSnapshot, encryptSnapshot } from './codec';
import { deriveSyncKey } from './crypto';

const SAMPLE = JSON.stringify({
  app: 'dotlearn',
  kind: 'progress-export',
  data: { progress: [{ id: 't:e1', n: 1 }] },
  s: 'ünïcode ✓ мир',
});

describe('legacy plaintext codec (local backups + pre-encryption server blobs)', () => {
  it('encodeSnapshot -> decodeSnapshot roundtrips', async () => {
    const blob = await encodeSnapshot(SAMPLE);
    expect(await decodeSnapshot(blob)).toBe(SAMPLE);
  });

  it('decodeSyncBlob still decodes a legacy gzip blob, with or without a key', async () => {
    const legacy = await encodeSnapshot(SAMPLE);
    const key = await deriveSyncKey('ABCD2345WXYZ');
    expect(await decodeSyncBlob(legacy, key)).toBe(SAMPLE);
    expect(await decodeSyncBlob(legacy, null)).toBe(SAMPLE);
  });
});

describe('DLS1 end-to-end-encrypted codec', () => {
  it('encryptSnapshot -> decodeSyncBlob roundtrips and frames the DLS1 magic', async () => {
    const key = await deriveSyncKey('ABCD2345WXYZ');
    const blob = await encryptSnapshot(SAMPLE, key);
    expect(blob.startsWith('RExT')).toBe(true); // base64 of the ASCII "DLS1" magic bytes
    expect(await decodeSyncBlob(blob, key)).toBe(SAMPLE);
  });

  it('surfaces "unsupported" when a DLS1 blob is decoded without a key', async () => {
    const key = await deriveSyncKey('ABCD2345WXYZ');
    const blob = await encryptSnapshot(SAMPLE, key);
    await expect(decodeSyncBlob(blob, null)).rejects.toMatchObject({ code: 'unsupported' });
  });

  it('surfaces "corrupt" when decrypted with the wrong key', async () => {
    const key = await deriveSyncKey('ABCD2345WXYZ');
    const wrong = await deriveSyncKey('ZZZZ9999QQQQ');
    const blob = await encryptSnapshot(SAMPLE, key);
    await expect(decodeSyncBlob(blob, wrong)).rejects.toMatchObject({ code: 'corrupt' });
  });
});
