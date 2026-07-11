// Snapshot blob codec for cross-device sync.
//
// Encodes an already-serialized progress-export JSON string into the opaque base64 blob the
// server stores (gzip-compressed when the browser supports CompressionStream, otherwise plain),
// and decodes it back. Format is self-describing: a decoded blob starting with the gzip magic
// bytes (1f 8b) is gzip, anything else is treated as plain UTF-8 — no separate "enc" field.
//
// No React/DOM-component imports: this module runs inside engine.ts (a controller, not a
// component) and inside plain unit tests.

const GZIP_MAGIC_0 = 0x1f;
const GZIP_MAGIC_1 = 0x8b;

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

/** Serializes `json` to UTF-8, gzips it when supported, and base64-encodes the result. */
export const encodeSnapshot = async (json: string): Promise<string> => {
  const raw = new TextEncoder().encode(json);
  const bytes = supportsCompression() ? await gzip(raw) : raw;
  return bytesToBase64(bytes);
};

/** Reverses {@link encodeSnapshot}, returning the JSON string (caller parses it). */
export const decodeSnapshot = async (blob: string): Promise<string> => {
  const bytes = base64ToBytes(blob);
  const isGzip = bytes.length >= 2 && bytes[0] === GZIP_MAGIC_0 && bytes[1] === GZIP_MAGIC_1;

  let plain: Bytes;
  if (isGzip) {
    if (!supportsCompression()) {
      throw new CodecError(
        'unsupported',
        'blob is gzip-compressed but DecompressionStream is unavailable',
      );
    }
    plain = await gunzip(bytes);
  } else {
    plain = bytes;
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(plain);
  } catch {
    throw new CodecError('corrupt', 'decoded bytes are not valid UTF-8');
  }
};

/** Cheap decoded-byte-count estimate from a base64 string's length + padding — no decode. */
export const base64ByteLength = (blob: string): number => {
  const len = blob.length;
  if (len === 0) return 0;
  const padding = blob.endsWith('==') ? 2 : blob.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((len * 3) / 4) - padding);
};
