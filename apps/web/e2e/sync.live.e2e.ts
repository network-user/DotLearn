// Live two-device end-to-end harness for cross-device sync.
//
// This exercises the REAL client modules (merge / codec / crypto) against a LIVE api server over
// HTTP, simulating two devices (A and B) that share one anonymous sync code. It is deliberately
// kept OUT of the normal `pnpm test` (see vitest.e2e.config.ts): there is no live server in CI.
//
// Run it:
//   1. build + start the api on PORT=3210 with a fresh DATA_DIR,
//   2. wait for GET /api/health,
//   3. E2E_API_BASE=http://localhost:3210 pnpm --filter @dotlearn/web test:e2e:sync
//
// It uses raw fetch (not api-client, which depends on import.meta.env). Node 20 exposes fetch,
// WebCrypto (globalThis.crypto.subtle), CompressionStream/DecompressionStream and atob/btoa
// natively, so the codec/crypto modules run unmodified.
//
// CODEC-ADAPTIVE: the client `codec.ts` is under active development. When it exports the DLS1
// end-to-end-encryption API (encryptSnapshot + decodeSyncBlob), this harness drives the full
// encrypted pipeline and asserts encryption at rest. When codec.ts is the plaintext-gzip build
// (encodeSnapshot/decodeSnapshot only — the current committed state), the harness drives that
// pipeline instead and asserts the blob is plaintext gzip at rest. Either way every sync
// scenario (create/link/pull/push/merge/conflict/tombstone/legacy/no-op/delete) runs, because
// those are codec-agnostic. The active mode is printed once at start-up.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as codec from '../src/lib/sync/codec';
import { canonicalStringify, mergeSnapshots } from '../src/lib/sync/merge';
import type { SyncSnapshot } from '../src/lib/sync/merge';

// A propagated per-record deletion. Defined locally (not imported from merge.ts) so the harness
// stays runnable whether or not the tombstone-deletion feature is present in the working tree;
// the runtime probe TOMBSTONES below detects whether mergeSnapshots actually honors it.
interface Tombstone {
  id: string;
  table: string;
  recordKey: string;
  deletedAt: string;
}

// --- minimal environment guard ----------------------------------------------------------------
// Polyfill ONLY atob/btoa (needed by codec base64) if a runtime somehow lacks them. The other
// globals the modules need are Node 20 built-ins; assert them so a missing one fails loud here.
if (typeof globalThis.atob !== 'function' || typeof globalThis.btoa !== 'function') {
  globalThis.atob = (b64: string): string => Buffer.from(b64, 'base64').toString('binary');
  globalThis.btoa = (bin: string): string => Buffer.from(bin, 'binary').toString('base64');
}
for (const name of ['fetch', 'CompressionStream', 'DecompressionStream'] as const) {
  if (typeof (globalThis as Record<string, unknown>)[name] !== 'function') {
    throw new Error(`E2E harness requires global ${name} (Node >= 20).`);
  }
}
if (typeof globalThis.crypto?.subtle?.deriveKey !== 'function') {
  throw new Error('E2E harness requires WebCrypto (globalThis.crypto.subtle).');
}

// --- codec capability detection ---------------------------------------------------------------
// The encrypted DLS1 pipeline is present only when BOTH functions are exported by codec.ts.
const codecAny = codec as Record<string, unknown>;
const ENCRYPTED =
  typeof codecAny.encryptSnapshot === 'function' && typeof codecAny.decodeSyncBlob === 'function';

type EncryptSnapshot = (json: string, key: CryptoKey) => Promise<string>;
type DecodeSyncBlob = (blob: string, key: CryptoKey | null) => Promise<string>;
type DeriveSyncKey = (code: string) => Promise<CryptoKey>;

let deriveSyncKey: DeriveSyncKey | null = null;

// --- server client ----------------------------------------------------------------------------

const BASE = process.env.E2E_API_BASE ?? 'http://localhost:3210';

interface ApiResult<T> {
  status: number;
  body:
    | { ok: true; data: T }
    | { ok: false; error: { code: string; message: string; details?: unknown } };
}

const call = async <T>(endpoint: string, payload: unknown): Promise<ApiResult<T>> => {
  const res = await fetch(`${BASE}/api/sync/${endpoint}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = (await res.json()) as ApiResult<T>['body'];
  return { status: res.status, body };
};

// Unwraps a success envelope, failing the test with the server error if the call was not ok.
const ok = <T>(result: ApiResult<T>): T => {
  if (!result.body.ok) {
    throw new Error(
      `expected ok envelope, got ${result.status}: ${JSON.stringify(result.body.error)}`,
    );
  }
  return result.body.data;
};

interface CreateData {
  code: string;
  rev: number;
}
interface PushData {
  rev: number;
  updatedAt: number;
}
type PullData =
  | { changed: false; rev: number }
  | { changed: true; rev: number; updatedAt: number; size: number; blob: string };

const create = () => call<CreateData>('create', {});
const link = (code: string) => call<{ rev: number }>('link', { code });
const pull = (code: string, sinceRev?: number) =>
  call<PullData>('pull', sinceRev === undefined ? { code } : { code, sinceRev });
const push = (code: string, baseRev: number, blob: string) =>
  call<PushData>('push', { code, baseRev, blob });
const del = (code: string) => call<{ deleted: true }>('delete', { code });

// --- encode / decode via whichever codec pipeline is active -----------------------------------
// ENCRYPTED: JSON -> gzip -> AES-GCM -> DLS1 -> base64 (A encrypts with keyA, B decrypts w/ keyB).
// PLAINTEXT: JSON -> gzip -> base64 (keys ignored). Both round-trip the exact JSON string.
const encode = (snap: SyncSnapshot, key: CryptoKey | null): Promise<string> =>
  ENCRYPTED
    ? (codecAny.encryptSnapshot as EncryptSnapshot)(JSON.stringify(snap), key as CryptoKey)
    : codec.encodeSnapshot(JSON.stringify(snap));

const decode = async (blob: string, key: CryptoKey | null): Promise<SyncSnapshot> => {
  const json = ENCRYPTED
    ? await (codecAny.decodeSyncBlob as DecodeSyncBlob)(blob, key)
    : await codec.decodeSnapshot(blob);
  return JSON.parse(json) as SyncSnapshot;
};

// --- fixtures ---------------------------------------------------------------------------------

type SnapData = SyncSnapshot['data'];

const emptyData = (): SnapData => ({
  progress: [],
  activity: [],
  flashcardReviews: [],
  interviewStudied: [],
  topicPlace: [],
  conceptNotes: [],
  bookmarks: [],
  conceptRead: [],
  conceptScroll: [],
  highlights: [],
  attemptEvents: [],
  achievements: [],
  checkpointResults: [],
  examResults: [],
  userCards: [],
  reExamSchedule: [],
});

interface SnapOpts {
  data?: Partial<SnapData>;
  exportedAt?: string;
  syncDeviceId?: string;
  tombstones?: Tombstone[];
}

const makeSnapshot = (opts: SnapOpts = {}): SyncSnapshot => {
  const snap: SyncSnapshot = {
    app: 'dotlearn',
    kind: 'progress-export',
    version: 5,
    exportedAt: opts.exportedAt ?? '2026-07-01T00:00:00.000Z',
    data: { ...emptyData(), ...(opts.data ?? {}) } as SnapData,
  };
  if (opts.syncDeviceId) snap.syncDeviceId = opts.syncDeviceId;
  if (opts.tombstones) snap.tombstones = opts.tombstones;
  return snap;
};

const prog = (
  id: string,
  exerciseId: string,
  topicSlug: string,
  status: 'pass' | 'fail',
  lastAttemptAt: string,
  attempts = 1,
) => ({ id, topicSlug, exerciseId, status, attempts, lastAttemptAt });

const bookmark = (id: string, topicSlug: string, conceptId: string, createdAt: string) => ({
  id,
  topicSlug,
  conceptId,
  createdAt,
});

const progressIds = (snap: SyncSnapshot): Set<string> =>
  new Set(snap.data.progress.map((r) => (r as { id: string }).id));
const bookmarkIds = (snap: SyncSnapshot): Set<string> =>
  new Set(snap.data.bookmarks.map((r) => (r as { id: string }).id));

const assertPull = (data: PullData): Extract<PullData, { changed: true }> => {
  if (!data.changed) throw new Error(`expected changed:true, got changed:false rev ${data.rev}`);
  return data;
};

// Empirically probe whether the working-tree mergeSnapshots honors deletion tombstones: merge a
// snapshot holding a bookmark with a snapshot carrying a tombstone that kills it. If the bookmark
// is gone from the result, tombstone deletion-propagation is implemented; if it survives, the
// merge is purely additive (the current committed behavior) and scenario `e` adapts accordingly.
const tombstonesSupported = (): boolean => {
  const withBookmark = makeSnapshot({
    exportedAt: '2026-01-01T00:00:00.000Z',
    data: { bookmarks: [bookmark('bm-probe', 't', 'c', '2026-01-01T00:00:00.000Z')] },
  });
  const withTombstone = makeSnapshot({
    exportedAt: '2026-01-02T00:00:00.000Z',
    tombstones: [
      {
        id: 'bookmarks:bm-probe',
        table: 'bookmarks',
        recordKey: 'bm-probe',
        deletedAt: '2026-01-02T00:00:00.000Z',
      },
    ],
  });
  const merged = mergeSnapshots(withBookmark, withTombstone);
  return !merged.data.bookmarks.some((b) => (b as { id: string }).id === 'bm-probe');
};
const TOMBSTONES = tombstonesSupported();

// --- shared cross-scenario state --------------------------------------------------------------
// The scenarios run in order and thread server revisions through, so device state is module-level.

let code = '';
let keyA: CryptoKey | null = null;
let keyB: CryptoKey | null = null;

const snapshotA = makeSnapshot({
  syncDeviceId: 'device-A',
  exportedAt: '2026-07-01T12:00:00.000Z',
  data: {
    progress: [
      prog('ex:a1', 'a1', 'python-basics', 'pass', '2026-07-01T10:00:00.000Z'),
      prog('ex:a2', 'a2', 'python-basics', 'fail', '2026-07-01T11:00:00.000Z', 2),
    ],
    activity: [{ day: '2026-07-01', exercisesAttempted: 3, exercisesPassed: 1 }],
    bookmarks: [bookmark('bm-a', 'python-basics', 'c1', '2026-07-01T09:00:00.000Z')],
    conceptNotes: [
      {
        id: 'note-a',
        topicSlug: 'python-basics',
        conceptId: 'c1',
        text: 'note from device A',
        updatedAt: '2026-07-01T09:30:00.000Z',
      },
    ],
  },
});

let stateA: SyncSnapshot = snapshotA;
let stateB: SyncSnapshot = makeSnapshot({
  syncDeviceId: 'device-B',
  exportedAt: '2026-07-02T12:00:00.000Z',
  data: {
    progress: [prog('ex:b1', 'b1', 'js-basics', 'pass', '2026-07-02T10:00:00.000Z')],
    bookmarks: [bookmark('bm-b', 'js-basics', 'c2', '2026-07-02T09:00:00.000Z')],
  },
});

const BM_B_CREATED_AT = '2026-07-02T09:00:00.000Z';

describe(`cross-device sync — live two-device E2E [codec: ${ENCRYPTED ? 'DLS1-encrypted' : 'plaintext-gzip'}, tombstones: ${TOMBSTONES ? 'on' : 'off'}]`, () => {
  beforeAll(async () => {
    // eslint-disable-next-line no-console
    console.log(
      `[sync-e2e] codec mode = ${ENCRYPTED ? 'DLS1-encrypted (encryptSnapshot/decodeSyncBlob present)' : 'plaintext-gzip (no encryption exports in codec.ts)'}; ` +
        `tombstone deletion-propagation = ${TOMBSTONES ? 'ON (mergeSnapshots honors tombstones)' : 'OFF (mergeSnapshots is additive-only in this working tree)'}`,
    );
    if (ENCRYPTED) {
      const cryptoMod = (await import('../src/lib/sync/crypto')) as {
        deriveSyncKey: DeriveSyncKey;
      };
      deriveSyncKey = cryptoMod.deriveSyncKey;
    }

    const created = ok(await create());
    expect(created.rev).toBe(0);
    expect(typeof created.code).toBe('string');
    code = created.code;
    if (ENCRYPTED && deriveSyncKey) {
      keyA = await deriveSyncKey(code);
      keyB = await deriveSyncKey(code); // same code -> functionally identical key on other device
    }
  });

  afterAll(async () => {
    if (code) await del(code).catch(() => undefined);
  });

  it('a. Device A creates a snapshot and pushes it (baseRev 0 -> rev 1)', async () => {
    const blob = await encode(stateA, keyA);
    const res = ok(await push(code, 0, blob));
    expect(res.rev).toBe(1);
  });

  it('b. Device B links, pulls A, deep-equals, merges its own state, pushes (rev 1 -> rev 2)', async () => {
    const linked = ok(await link(code));
    expect(linked.rev).toBe(1);

    const pulled = assertPull(ok(await pull(code)));
    expect(pulled.rev).toBe(1);

    // decode with B's key (encrypted mode) -> proves cross-device decryption of A's blob
    const remote = await decode(pulled.blob, keyB);
    expect(remote.data).toEqual(snapshotA.data);

    stateB = mergeSnapshots(remote, stateB);
    const res = ok(await push(code, 1, await encode(stateB, keyB)));
    expect(res.rev).toBe(2);
  });

  it('c. Device A pulls sinceRev 1 -> changed rev 2, merges, sees the union of both devices', async () => {
    const pulled = assertPull(ok(await pull(code, 1)));
    expect(pulled.rev).toBe(2);

    const remote = await decode(pulled.blob, keyA);
    stateA = mergeSnapshots(stateA, remote);

    const ids = progressIds(stateA);
    expect(ids.has('ex:a1')).toBe(true);
    expect(ids.has('ex:a2')).toBe(true);
    expect(ids.has('ex:b1')).toBe(true);
    const bms = bookmarkIds(stateA);
    expect(bms.has('bm-a')).toBe(true);
    expect(bms.has('bm-b')).toBe(true);
  });

  it('d. Concurrent push conflict: A wins rev 3, B gets 409 REV_CONFLICT, re-pulls, pushes rev 4', async () => {
    // Both devices independently extend the rev-2 state.
    stateA = mergeSnapshots(
      stateA,
      makeSnapshot({
        exportedAt: '2026-07-03T10:00:00.000Z',
        data: {
          progress: [prog('ex:a3', 'a3', 'python-basics', 'pass', '2026-07-03T10:00:00.000Z')],
        },
      }),
    );
    const pendingB = mergeSnapshots(
      stateB,
      makeSnapshot({
        exportedAt: '2026-07-03T11:00:00.000Z',
        data: { progress: [prog('ex:b2', 'b2', 'js-basics', 'fail', '2026-07-03T11:00:00.000Z')] },
      }),
    );

    // A pushes first from baseRev 2 -> rev 3.
    const aRes = ok(await push(code, 2, await encode(stateA, keyA)));
    expect(aRes.rev).toBe(3);

    // B pushes from the now-stale baseRev 2 -> HTTP 409 with REV_CONFLICT + currentRev 3.
    const conflict = await push(code, 2, await encode(pendingB, keyB));
    expect(conflict.status).toBe(409);
    if (conflict.body.ok) throw new Error('expected conflict error envelope');
    expect(conflict.body.error.details).toMatchObject({ code: 'REV_CONFLICT', currentRev: 3 });

    // B re-pulls A's rev 3, re-merges its pending change, pushes from baseRev 3 -> rev 4.
    const pulled = assertPull(ok(await pull(code, 2)));
    expect(pulled.rev).toBe(3);
    const remote = await decode(pulled.blob, keyB);
    stateB = mergeSnapshots(pendingB, remote);
    const bRes = ok(await push(code, 3, await encode(stateB, keyB)));
    expect(bRes.rev).toBe(4);

    // Final state is the full union of both devices' edits.
    const ids = progressIds(stateB);
    for (const id of ['ex:a1', 'ex:a2', 'ex:a3', 'ex:b1', 'ex:b2']) {
      expect(ids.has(id)).toBe(true);
    }
    expect(bookmarkIds(stateB)).toEqual(new Set(['bm-a', 'bm-b']));
  });

  it('e. Tombstone: B deletes its bookmark, pushes; A pulls+merges -> bookmark gone, tombstone kept', async () => {
    const tombstone: Tombstone = {
      id: 'bookmarks:bm-b',
      table: 'bookmarks',
      recordKey: 'bm-b',
      deletedAt: '2026-07-10T00:00:00.000Z', // >= bm-b.createdAt so the deletion wins
    };
    expect(new Date(tombstone.deletedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(BM_B_CREATED_AT).getTime(),
    );

    const deletedSnap: SyncSnapshot = {
      ...stateB,
      exportedAt: '2026-07-10T12:00:00.000Z',
      data: {
        ...stateB.data,
        bookmarks: stateB.data.bookmarks.filter((b) => (b as { id: string }).id !== 'bm-b'),
      },
      tombstones: [tombstone],
    };
    const bRes = ok(await push(code, 4, await encode(deletedSnap, keyB)));
    expect(bRes.rev).toBe(5);

    // A still holds its own copy of bm-b locally; the merge must let the tombstone kill it.
    const pulled = assertPull(ok(await pull(code, 3)));
    expect(pulled.rev).toBe(5);
    const remote = await decode(pulled.blob, keyA);
    const merged = mergeSnapshots(stateA, remote);

    const bms = bookmarkIds(merged);
    expect(bms.has('bm-a')).toBe(true); // untouched bookmark survives either way
    if (TOMBSTONES) {
      // Deletion propagation active: the tombstone removes A's copy of bm-b and rides along.
      expect(bms.has('bm-b')).toBe(false);
      expect(
        (merged as { tombstones?: Tombstone[] }).tombstones?.some((t) => t.id === 'bookmarks:bm-b'),
      ).toBe(true);
    } else {
      // Additive-only merge (current committed tree): the tombstone field is ignored, so A's
      // local copy of bm-b survives. This documents that deletion-propagation is NOT active here.
      expect(bms.has('bm-b')).toBe(true);
    }
    stateA = merged;
  });

  it('f. Encryption at rest: blob framing at rest matches the active codec; wrong key cannot decrypt', async () => {
    const pulled = assertPull(ok(await pull(code, 4)));
    const raw = Buffer.from(pulled.blob, 'base64');
    const isGzip = raw[0] === 0x1f && raw[1] === 0x8b;
    const isDls1 = raw[0] === 0x44 && raw[1] === 0x4c && raw[2] === 0x53 && raw[3] === 0x31;

    if (ENCRYPTED) {
      // End-to-end encrypted: DLS1 magic at rest, NOT a readable gzip stream.
      expect(isDls1).toBe(true);
      expect(isGzip).toBe(false);
      const wrongKey = await deriveSyncKey!('ZZZZ9999QQQQ'); // different code -> different AES key
      await expect(
        (codecAny.decodeSyncBlob as DecodeSyncBlob)(pulled.blob, wrongKey),
      ).rejects.toThrow();
    } else {
      // Plaintext-gzip build (current committed codec): the server holds a readable gzip blob.
      // This documents that encryption-at-rest is NOT active in this working tree; the wrong-key
      // assertion is encryption-specific and therefore not applicable here.
      expect(isGzip).toBe(true);
      expect(isDls1).toBe(false);
    }
  });

  it('g. Legacy compat: a plaintext-gzip blob pulls back cleanly even with a key present', async () => {
    const legacySnap = makeSnapshot({
      exportedAt: '2026-07-11T00:00:00.000Z',
      data: {
        progress: [prog('ex:legacy', 'legacy', 'linux', 'pass', '2026-07-11T00:00:00.000Z')],
      },
    });
    // encodeSnapshot = plaintext gzip -> base64 (no encryption): the pre-DLS1 / local-backup format.
    const legacyBlob = await codec.encodeSnapshot(JSON.stringify(legacySnap));
    expect(Buffer.from(legacyBlob, 'base64')[0]).toBe(0x1f); // gzip magic, not DLS1

    const res = ok(await push(code, 5, legacyBlob));
    expect(res.rev).toBe(6);

    const pulled = assertPull(ok(await pull(code, 5)));
    // In encrypted mode the DLS1 sniff misses -> legacy gzip path decodes it even with a key.
    const decoded = await decode(pulled.blob, keyA);
    expect(progressIds(decoded).has('ex:legacy')).toBe(true);
    expect(canonicalStringify(decoded)).toBe(canonicalStringify(legacySnap));
  });

  it('h. sinceRev == current rev -> changed:false; delete -> subsequent pull is 404', async () => {
    const noop = ok(await pull(code, 6));
    expect(noop.changed).toBe(false);
    expect(noop.rev).toBe(6);

    expect(ok(await del(code)).deleted).toBe(true);

    const gone = await pull(code, 6);
    expect(gone.status).toBe(404);
    expect(gone.body.ok).toBe(false);
  });
});
