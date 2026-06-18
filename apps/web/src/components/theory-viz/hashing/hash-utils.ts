export type VizLang = 'ru' | 'en';

export const fnv1a = (input: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    hash ^= code & 0xff;
    hash = Math.imul(hash, 0x01000193);
    hash ^= (code >> 8) & 0xff;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

export const toHex = (value: number, width = 8): string =>
  (value >>> 0).toString(16).padStart(width, '0');

export const popcount = (value: number): number => {
  let v = value >>> 0;
  let count = 0;
  while (v !== 0) {
    count += v & 1;
    v >>>= 1;
  }
  return count;
};

export const bits32 = (value: number): number[] => {
  const result: number[] = [];
  for (let i = 31; i >= 0; i -= 1) {
    result.push((value >>> i) & 1);
  }
  return result;
};
