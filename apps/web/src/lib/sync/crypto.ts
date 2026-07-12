// End-to-end encryption for cross-device sync blobs.
//
// The server is blind storage: it only ever sees sha256(code) (the lookup key) and an opaque
// ciphertext blob. This module derives the symmetric key both devices share — deterministically,
// from the sync code itself — so a snapshot encrypted on one device decrypts on the other with no
// key exchange.
//
// Key derivation: PBKDF2(SHA-256, 100_000 iterations) over the canonical sync code, with a
// CONSTANT salt string. A constant salt is normally a red flag, but it is correct here and
// required:
//   - Determinism across devices is mandatory — both sides must derive the identical key from the
//     same code with no shared random salt to exchange (there is no login/account to hang one on).
//   - The "password" is not a low-entropy human secret: a sync code is 64 random bits (12 Crockford
//     base32 chars). A per-target random salt only buys resistance to precomputed rainbow tables
//     against weak/reused human passwords; against a full-entropy random code there is nothing to
//     precompute cheaply, so the constant salt costs no meaningful security here.
//   - The salt is versioned (`dotlearn-sync-e2e-v1`) so the scheme can be rotated later.
// The server never sees the code, only sha256(code); sha256(code) does not reveal the
// PBKDF2-derived AES key (different KDF, different salt, different iteration count).
//
// No React/DOM-component imports: this runs inside engine.ts and inside plain unit tests
// (Node exposes WebCrypto at globalThis.crypto.subtle).

const PBKDF2_SALT = 'dotlearn-sync-e2e-v1';
const PBKDF2_ITERATIONS = 100_000;
const AES_KEY_BITS = 256;
export const SYNC_IV_BYTES = 12; // AES-GCM standard nonce length

// Pinned to the ArrayBuffer-backed specialization so these bytes satisfy BufferSource without the
// wider ArrayBufferLike default tripping up structuredClone/Blob call sites.
type Bytes = Uint8Array<ArrayBuffer>;

const asBytes = (buffer: ArrayBuffer): Bytes => new Uint8Array(buffer);

/**
 * Derives the AES-GCM-256 key a device group shares, from the canonical (normalized) sync code.
 * Deterministic: same code -> same key on every device. See the file header for why a constant
 * salt is acceptable. The returned key is non-extractable and scoped to encrypt/decrypt.
 */
export const deriveSyncKey = async (code: string): Promise<CryptoKey> => {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(code),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new TextEncoder().encode(PBKDF2_SALT),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: AES_KEY_BITS },
    false,
    ['encrypt', 'decrypt'],
  );
};

/**
 * Encrypts `plain` with a fresh random 12-byte IV. Returns IV ++ ciphertext (the ciphertext
 * already carries the GCM auth tag). Framing (magic prefix, base64) is the codec's job.
 */
export const encryptBytes = async (key: CryptoKey, plain: Bytes): Promise<Bytes> => {
  const iv = crypto.getRandomValues(new Uint8Array(SYNC_IV_BYTES));
  const cipher = asBytes(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain));
  const out = new Uint8Array(SYNC_IV_BYTES + cipher.length);
  out.set(iv, 0);
  out.set(cipher, SYNC_IV_BYTES);
  return out;
};

/**
 * Reverses {@link encryptBytes}: splits IV ++ ciphertext and decrypts. Throws (DOMException) on a
 * wrong key or tampered ciphertext — GCM authentication fails closed. Callers map that to a codec
 * error.
 */
export const decryptBytes = async (key: CryptoKey, ivAndCipher: Bytes): Promise<Bytes> => {
  const iv = ivAndCipher.subarray(0, SYNC_IV_BYTES);
  const cipher = ivAndCipher.subarray(SYNC_IV_BYTES);
  return asBytes(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher));
};
