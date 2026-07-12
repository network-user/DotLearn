// Snapshot blob codec for cross-device sync.
//
// Encodes an already-serialized progress-export JSON string into the opaque base64 blob the
// server stores, and decodes it back. Two formats, both self-describing by their leading bytes
// after base64-decoding:
//
//   DLS1 (v2, end-to-end encrypted): ASCII magic `DLS1` (44 4c 53 31) + 12-byte AES-GCM IV +
//        AES-GCM ciphertext over the GZIPPED JSON. The server can never read it (see crypto.ts).
//   gzip (v1, legacy): raw gzip stream (magic 1f 8b) — plaintext, produced before e2e encryption
//        shipped. Still decoded for backward compatibility; the first encrypted push overwrites the
//        server copy with DLS1.
//   plain (v1 fallback): anything else is treated as plain UTF-8 (environments without
//        CompressionStream).
//
// encode path (sync push):  gzip -> encrypt -> base64        (encryptSnapshot)
// decode path (sync pull):  base64 -> sniff -> decrypt/gunzip (decodeSyncBlob)
// Local syncBackups keep using the plaintext encodeSnapshot/decodeSnapshot pair — they never leave
// the device.
//
// No React/DOM-component imports: this module runs inside engine.ts (a controller, not a
// component) and inside plain unit tests.

import { decryptBytes, encryptBytes } from './crypto';

const GZIP_MAGIC_0 = 0x1f;
const GZIP_MAGIC_1 = 0x8b;

// ASCII "DLS1" — the end-to-end-encrypted blob marker.
const DLS1_MAGIC = new Uint8Array([0x44, 0x4c, 0x53, 0x31]);

// String.fromCharCode(...spread) on a large typed array blows the call stack (arguments limit),
// so base64 encoding walks the bytes in bounded chunks instead.
const BASE64_CHUNK_BYTES = 8192;

export type CodecErrorCode = 'unsupported' | 'corrupt';

export class CodecError extends Error {
  constructor(
    public readonly code: CodecErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CodecError';
  }
}

/** Feature-detects the streaming compression APIs used to gzip snapshots. */
export const supportsCompression = (): boolean =>
  typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';

// Pinned to the ArrayBuffer-backed Uint8Array specialization (not the wider ArrayBufferLike
// default) so these bytes satisfy BlobPart when handed to `new Blob([bytes])` below.
type Bytes = Uint8Array<ArrayBuffer>;

const bytesToBase64 = (bytes: Bytes): string => {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_BYTES) {
    const chunk = bytes.subarray(offset, offset + BASE64_CHUNK_BYTES);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

const base64ToBytes = (blob: string): Bytes => {
  let binary: string;
  try {
    binary = atob(blob);
  } catch {
    throw new CodecError('corrupt', 'blob is not valid base64');
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const gzip = async (bytes: Bytes): Promise<Bytes> => {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
};

const gunzip = async (bytes: Bytes): Promise<Bytes> => {
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const buffer = await new Response(stream).arrayBuffer();
    return new Uint8Array(buffer);
  } catch {
    throw new CodecError('corrupt', 'blob is not a valid gzip stream');
  }
};

const hasMagic = (bytes: Bytes, magic: Uint8Array): boolean => {
  if (bytes.length < magic.length) return false;
  for (let i = 0; i < magic.length; i++) {
    if (bytes[i] !== magic[i]) return false;
  }
  return true;
};

const isGzip = (bytes: Bytes): boolean =>
  bytes.length >= 2 && bytes[0] === GZIP_MAGIC_0 && bytes[1] === GZIP_MAGIC_1;

const decodeUtf8 = (bytes: Bytes): string => {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new CodecError('corrupt', 'decoded bytes are not valid UTF-8');
  }
};

// Turns already-base64-decoded bytes into the JSON string: gunzip when gzip-framed, else plain.
const bytesToJson = async (bytes: Bytes): Promise<string> => {
  if (isGzip(bytes)) {
    if (!supportsCompression()) {
      throw new CodecError(
        'unsupported',
        'blob is gzip-compressed but DecompressionStream is unavailable',
      );
    }
    return decodeUtf8(await gunzip(bytes));
  }
  return decodeUtf8(bytes);
};

/** Serializes `json` to UTF-8, gzips it when supported, and base64-encodes the result (plaintext). */
export const encodeSnapshot = async (json: string): Promise<string> => {
  const raw = new TextEncoder().encode(json);
  const bytes = supportsCompression() ? await gzip(raw) : raw;
  return bytesToBase64(bytes);
};

/** Reverses {@link encodeSnapshot}, returning the JSON string (caller parses it). Plaintext only. */
export const decodeSnapshot = async (blob: string): Promise<string> => {
  return bytesToJson(base64ToBytes(blob));
};

/**
 * End-to-end-encrypted encode: gzip -> AES-GCM encrypt -> `DLS1` framing -> base64. Requires
 * CompressionStream (callers only reach this when {@link supportsCompression} is true and a key is
 * available; otherwise they fall back to {@link encodeSnapshot}).
 */
export const encryptSnapshot = async (json: string, key: CryptoKey): Promise<string> => {
  const gz = await gzip(new TextEncoder().encode(json));
  const ivAndCipher = await encryptBytes(key, gz);
  const framed = new Uint8Array(DLS1_MAGIC.length + ivAndCipher.length);
  framed.set(DLS1_MAGIC, 0);
  framed.set(ivAndCipher, DLS1_MAGIC.length);
  return bytesToBase64(framed);
};

/**
 * Decodes a server blob of either format back to the JSON string:
 *   - `DLS1`  -> decrypt with `key` (CodecError 'corrupt' on a wrong key / tampered ciphertext,
 *               'unsupported' when no key is available) -> gunzip.
 *   - gzip / plain -> legacy plaintext path (backward compatibility with pre-encryption blobs).
 */
export const decodeSyncBlob = async (blob: string, key: CryptoKey | null): Promise<string> => {
  const bytes = base64ToBytes(blob);
  if (hasMagic(bytes, DLS1_MAGIC)) {
    if (!key) {
      throw new CodecError('unsupported', 'blob is end-to-end encrypted but no key is available');
    }
    if (!supportsCompression()) {
      throw new CodecError(
        'unsupported',
        'blob is end-to-end encrypted but DecompressionStream is unavailable',
      );
    }
    let inner: Bytes;
    try {
      inner = await decryptBytes(key, bytes.subarray(DLS1_MAGIC.length));
    } catch {
      throw new CodecError(
        'corrupt',
        'blob failed authenticated decryption (wrong key or tampered)',
      );
    }
    return decodeUtf8(await gunzip(inner));
  }
  return bytesToJson(bytes);
};

/** Cheap decoded-byte-count estimate from a base64 string's length + padding — no decode. */
export const base64ByteLength = (blob: string): number => {
  const len = blob.length;
  if (len === 0) return 0;
  const padding = blob.endsWith('==') ? 2 : blob.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((len * 3) / 4) - padding);
};
