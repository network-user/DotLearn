import { describe, expect, it } from 'vitest';

import {
  formatSyncCode,
  normalizeSyncCode,
  SYNC_BLOB_MAX_CHARS,
  SyncBlob,
  SyncCode,
  SyncPullOutput,
  SyncPushInput,
} from './sync.schema';

describe('normalizeSyncCode', () => {
  it('uppercases and strips dash separators', () => {
    expect(normalizeSyncCode('abcd-2345-6789')).toBe('ABCD23456789');
  });

  it('strips arbitrary non-alphanumeric separators', () => {
    expect(normalizeSyncCode('abcd 2345_6789')).toBe('ABCD23456789');
  });

  it('maps the O/I/L confusables to their canonical digits', () => {
    expect(normalizeSyncCode('oil0-oil0-oil0')).toBe('011001100110');
  });
});

describe('formatSyncCode', () => {
  it('groups a 12-char code into XXXX-XXXX-XXXX', () => {
    expect(formatSyncCode('0123456789AB')).toBe('0123-4567-89AB');
  });
});

describe('SyncCode', () => {
  it('accepts a canonical 12-char code from the sync alphabet', () => {
    expect(SyncCode.parse('0123456789AB')).toBe('0123456789AB');
  });

  it('rejects the wrong length', () => {
    expect(SyncCode.safeParse('0123456789A').success).toBe(false);
  });

  it('rejects lowercase input (callers must normalize first)', () => {
    expect(SyncCode.safeParse('0123456789ab').success).toBe(false);
  });

  it('rejects excluded confusable characters (I, L, O, U)', () => {
    expect(SyncCode.safeParse('IIIIIIIIIIII').success).toBe(false);
    expect(SyncCode.safeParse('OOOOOOOOOOOO').success).toBe(false);
    expect(SyncCode.safeParse('UUUUUUUUUUUU').success).toBe(false);
  });
});

describe('SyncBlob', () => {
  it('accepts a well-formed base64 string', () => {
    expect(SyncBlob.parse('aGVsbG8=')).toBe('aGVsbG8=');
  });

  it('rejects non-base64 characters', () => {
    expect(SyncBlob.safeParse('not base64!!').success).toBe(false);
  });

  it('rejects a length that is not a multiple of 4', () => {
    expect(SyncBlob.safeParse('abcde').success).toBe(false);
  });

  it('rejects a blob over the protocol cap', () => {
    const oversized = 'A'.repeat(SYNC_BLOB_MAX_CHARS + 4);
    expect(SyncBlob.safeParse(oversized).success).toBe(false);
  });
});

describe('SyncPushInput', () => {
  const CODE = '0123456789AB';

  it('accepts a well-formed push', () => {
    expect(SyncPushInput.parse({ code: CODE, baseRev: 0, blob: 'aGVsbG8=' })).toEqual({
      code: CODE,
      baseRev: 0,
      blob: 'aGVsbG8=',
    });
  });

  it('rejects a missing field', () => {
    expect(SyncPushInput.safeParse({ code: CODE, blob: 'aGVsbG8=' }).success).toBe(false);
  });

  it('rejects a negative baseRev', () => {
    expect(SyncPushInput.safeParse({ code: CODE, baseRev: -1, blob: 'aGVsbG8=' }).success).toBe(
      false,
    );
  });

  it('rejects extra keys (strict)', () => {
    expect(
      SyncPushInput.safeParse({ code: CODE, baseRev: 0, blob: 'aGVsbG8=', extra: 1 }).success,
    ).toBe(false);
  });
});

describe('SyncPullOutput', () => {
  it('accepts an unchanged response without a blob', () => {
    expect(SyncPullOutput.parse({ changed: false, rev: 3 })).toEqual({ changed: false, rev: 3 });
  });

  it('accepts a changed response with a blob', () => {
    const payload = {
      changed: true,
      rev: 4,
      updatedAt: 1_700_000_000_000,
      size: 8,
      blob: 'aGVsbG8=',
    };
    expect(SyncPullOutput.parse(payload)).toEqual(payload);
  });

  it('rejects a changed:true response missing the blob', () => {
    expect(SyncPullOutput.safeParse({ changed: true, rev: 4, updatedAt: 1, size: 8 }).success).toBe(
      false,
    );
  });

  it('rejects an unchanged response carrying an extra field (strict)', () => {
    expect(SyncPullOutput.safeParse({ changed: false, rev: 3, blob: 'aGVsbG8=' }).success).toBe(
      false,
    );
  });
});
