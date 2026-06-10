import { db } from './progress-db';

const KEY_ID = 'byok-aes-gcm-v1';
const PAYLOAD_PREFIX = 'v1';

let keyPromise: Promise<CryptoKey> | undefined;

const getKey = async (): Promise<CryptoKey> => {
  if (!keyPromise) {
    keyPromise = (async () => {
      const existing = await db.cryptoKeys.get(KEY_ID);
      if (existing) {
        return existing.key;
      }
      const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
        'encrypt',
        'decrypt',
      ]);
      await db.cryptoKeys.put({ id: KEY_ID, key });
      return key;
    })();
  }
  return keyPromise;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

const fromBase64 = (value: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const utf8Bytes = (value: string): Uint8Array<ArrayBuffer> => {
  const encoded = encoder.encode(value);
  const bytes = new Uint8Array(encoded.length);
  bytes.set(encoded);
  return bytes;
};

const isEncrypted = (value: string): boolean => value.startsWith(`${PAYLOAD_PREFIX}:`);

export const encryptSecret = async (plaintext: string): Promise<string> => {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    utf8Bytes(plaintext),
  );
  return `${PAYLOAD_PREFIX}:${toBase64(iv)}:${toBase64(new Uint8Array(ciphertext))}`;
};

export const decryptSecret = async (payload: string): Promise<string | undefined> => {
  if (!isEncrypted(payload)) {
    return payload;
  }
  const [, ivPart, dataPart] = payload.split(':');
  if (!ivPart || !dataPart) {
    return undefined;
  }
  try {
    const key = await getKey();
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(ivPart) },
      key,
      fromBase64(dataPart),
    );
    return decoder.decode(plaintext);
  } catch {
    return undefined;
  }
};
