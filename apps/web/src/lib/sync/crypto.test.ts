/**
 * @vitest-environment node
 *
 * WebCrypto (globalThis.crypto.subtle) is available in the plain node environment; jsdom does not
 * provide it, so this suite opts into node via the docblock (same pattern as merge.test.ts).
 */
import { describe, expect, it } from 'vitest';

import { decryptBytes, deriveSyncKey, encryptBytes, SYNC_IV_BYTES } from './crypto';

const bytes = (s: string): Uint8Array<ArrayBuffer> => new Uint8Array(new TextEncoder().encode(s));
const text = (b: Uint8Array): string => new TextDecoder().decode(b);

describe('deriveSyncKey', () => {
  it('is deterministic: a key derived from the same code decrypts the other device’s ciphertext', async () => {
    const keyA = await deriveSyncKey('ABCD2345WXYZ');
    const keyB = await deriveSyncKey('ABCD2345WXYZ');
    const cipher = await encryptBytes(keyA, bytes('cross-device plaintext'));
    expect(text(await decryptBytes(keyB, cipher))).toBe('cross-device plaintext');
  });

  it('derives a different key per code (cross-decrypt fails auth)', async () => {
    const keyA = await deriveSyncKey('ABCD2345WXYZ');
    const keyB = await deriveSyncKey('ZZZZ9999QQQQ');
    const cipher = await encryptBytes(keyA, bytes('secret'));
    await expect(decryptBytes(keyB, cipher)).rejects.toBeDefined();
  });
});

describe('encryptBytes / decryptBytes', () => {
  it('roundtrips arbitrary bytes', async () => {
    const key = await deriveSyncKey('ABCD2345WXYZ');
    const plain = bytes(JSON.stringify({ hello: 'wörld', n: 42, xs: [1, 2, 3] }));
    const cipher = await encryptBytes(key, plain);
    expect(cipher.length).toBeGreaterThan(SYNC_IV_BYTES); // IV (12) + ciphertext + GCM tag
    expect(text(await decryptBytes(key, cipher))).toBe(text(plain));
  });

  it('uses a fresh random IV each call (ciphertext differs for identical plaintext)', async () => {
    const key = await deriveSyncKey('ABCD2345WXYZ');
    const a = await encryptBytes(key, bytes('repeat me'));
    const b = await encryptBytes(key, bytes('repeat me'));
    expect(Buffer.from(a).toString('hex')).not.toBe(Buffer.from(b).toString('hex'));
  });

  it('detects tampering: flipping a ciphertext byte fails authentication', async () => {
    const key = await deriveSyncKey('ABCD2345WXYZ');
    const cipher = await encryptBytes(key, bytes('integrity-protected'));
    const last = cipher.length - 1;
    cipher[last] = (cipher[last] ?? 0) ^ 0xff; // corrupt inside the ciphertext/GCM tag
    await expect(decryptBytes(key, cipher)).rejects.toBeDefined();
  });
});
