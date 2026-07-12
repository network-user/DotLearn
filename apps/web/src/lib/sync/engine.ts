// Cross-device sync engine — client controller.
//
// Mirrors the presence.ts house pattern: a module-level store surfaced through a
// useSyncExternalStore hook, a Web-Locks-elected leader that owns the timers, a BroadcastChannel
// to keep sibling tabs coherent, visibility-driven scheduling, fetch-failure backoff and HMR
// dispose cleanup.
//
// The protocol is snapshot + optimistic concurrency: pull the remote blob, merge it with the
// local export (see merge.ts — symmetric/idempotent), apply the result to Dexie, then push back
// with baseRev optimistic locking (409 -> re-pull, re-merge, retry). All merge logic is client
// side; the server never parses a blob.
//
// One deliberate deviation from the literal spec wording: the "should I push / should I apply"
// comparisons use a *data fingerprint* (snapshotHash over the snapshot with the volatile
// top-level `exportedAt` and `syncDeviceId` stripped) rather than the raw snapshotHash. Every
// exportProgress() stamps a fresh `exportedAt`, so a raw-hash comparison would never match and
// two devices holding identical data would ping-pong pushes forever (rev++ on each side with no
// new information), breaking convergence. Fingerprinting the *information* keeps the idempotent
// merge idempotent end-to-end. `lastPushedHash` therefore stores a fingerprint.

import { useEffect, useSyncExternalStore } from 'react';

import { type Table } from 'dexie';

import {
  normalizeSyncCode,
  SyncCode,
  SyncPushConflict,
  SYNC_BLOB_MAX_CHARS,
  type SyncPullOutput,
} from '@dotlearn/contracts';

import {
  ApiError,
  createSyncCode,
  deleteSyncCode,
  linkSyncCode,
  pullSync,
  pushSync,
} from '../api-client';
import {
  db,
  getSyncBackup,
  saveSyncBackup,
  type AttemptEventRecord,
  type CheckpointResultRecord,
  type SyncTombstoneRecord,
} from '../progress-db';
import { clearAllProgress, exportProgress, importProgress } from '../progress-io';
import { importSettings } from '../settings';

import {
  CodecError,
  decodeSnapshot,
  decodeSyncBlob,
  encodeSnapshot,
  encryptSnapshot,
  supportsCompression,
} from './codec';
import { deriveSyncKey } from './crypto';
import { canonicalStringify, mergeSnapshots, snapshotHash, type SyncSnapshot } from './merge';

// --- public types (pinned — a parallel UI agent builds against this exact shape) ---------------

export type SyncPhase = 'idle' | 'syncing' | 'offline' | 'error' | 'too-large';
export type SyncErrorCode =
  | 'network'
  | 'not-found'
  | 'too-large'
  | 'conflict-loop'
  | 'unsupported'
  | 'server'
  | null;

export interface SyncStatus {
  linked: boolean;
  code: string | null; // canonical 12-char code (UI formats with formatSyncCode)
  phase: SyncPhase;
  lastSyncAt: number | null; // epoch ms of last successful sync
  lastError: SyncErrorCode;
  pending: boolean; // local changes not yet pushed
}

// --- constants ---------------------------------------------------------------------------------

const META_KEY = 'dotlearn:sync';
const LOCK_NAME = 'dotlearn-sync-leader';
const CHANNEL_NAME = 'dotlearn:sync';

const PULL_INTERVAL_MS = 5 * 60_000;
const VISIBLE_STALE_MS = 2 * 60_000;
const DEBOUNCE_MS = 5_000;
const DEBOUNCE_MAX_WAIT_MS = 30_000;
const BACKOFF_MIN_MS = 60_000;
const BACKOFF_MAX_MS = 120_000;
const MAX_CONFLICT_RETRIES = 5;
const CONFLICT_BACKOFF_MIN_MS = 250;
const CONFLICT_BACKOFF_MAX_MS = 1_000;
const KEEPALIVE_MAX_CHARS = 60_000;

// Tables synced across devices (the 16 in a ProgressExport). Excludes syncBackups, playground and
// playgroundSnippets on purpose — those are local-only.
const SYNCED_TABLE_NAMES = [
  'progress',
  'activity',
  'flashcardReviews',
  'interviewStudied',
  'topicPlace',
  'conceptNotes',
  'bookmarks',
  'conceptRead',
  'conceptScroll',
  'highlights',
  'attemptEvents',
  'achievements',
  'checkpointResults',
  'examResults',
  'userCards',
  'reExamSchedule',
] as const;

// Tables with genuine per-record USER deletion flows: a deletion in one of these is recorded as a
// tombstone (progress-db syncTombstones) so it propagates to other devices instead of being
// resurrected by the additive merge. All are keyed by `id`. Excludes conceptScroll (auto-reset
// reading position, not a user delete), flashcardReviews (only ever cascade-deleted alongside its
// own user card), attemptEvents (prune cap) and every bulk clear (clearAllProgress / restore).
const TOMBSTONE_TABLE_NAMES = [
  'bookmarks',
  'highlights',
  'conceptNotes',
  'userCards',
  'interviewStudied',
  'conceptRead',
] as const;

const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000; // prune deletions older than 90 days
const TOMBSTONE_CAP = 2000; // and keep at most the newest 2000 locally

// --- meta (localStorage, synchronous) ----------------------------------------------------------

interface SyncMeta {
  code: string | null;
  deviceId: string;
  lastRev: number;
  lastPushedHash: string | null; // data fingerprint of the last snapshot the server holds
  lastSyncAt: number | null;
}

const newDeviceId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const persistMeta = (value: SyncMeta): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(META_KEY, JSON.stringify(value));
  } catch {
    // storage unavailable (private mode) — meta lives for this session only
  }
};

const readMeta = (): SyncMeta => {
  const base: SyncMeta = {
    code: null,
    deviceId: '',
    lastRev: 0,
    lastPushedHash: null,
    lastSyncAt: null,
  };
  if (typeof window === 'undefined') return base;
  try {
    const raw = window.localStorage.getItem(META_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SyncMeta>;
      if (typeof parsed.code === 'string') base.code = parsed.code;
      if (typeof parsed.deviceId === 'string') base.deviceId = parsed.deviceId;
      if (typeof parsed.lastRev === 'number' && Number.isFinite(parsed.lastRev)) {
        base.lastRev = parsed.lastRev;
      }
      if (typeof parsed.lastPushedHash === 'string') base.lastPushedHash = parsed.lastPushedHash;
      if (typeof parsed.lastSyncAt === 'number' && Number.isFinite(parsed.lastSyncAt)) {
        base.lastSyncAt = parsed.lastSyncAt;
      }
    }
  } catch {
    // fall through with defaults
  }
  if (!base.deviceId) {
    base.deviceId = newDeviceId();
    persistMeta(base);
  }
  return base;
};

let meta: SyncMeta = readMeta();

const writeMeta = (patch: Partial<SyncMeta>): void => {
  meta = { ...meta, ...patch };
  persistMeta(meta);
};

const reloadMeta = (): void => {
  meta = readMeta();
};

// --- store (useSyncExternalStore) --------------------------------------------------------------

let phase: SyncPhase = 'idle';
let lastError: SyncErrorCode = null;
let dirty = false; // unpushed local mutations known to this tab

const DEFAULT_STATUS: SyncStatus = Object.freeze({
  linked: false,
  code: null,
  phase: 'idle',
  lastSyncAt: null,
  lastError: null,
  pending: false,
});

let status: SyncStatus = computeStatus();
const listeners = new Set<() => void>();

function computeStatus(): SyncStatus {
  return {
    linked: meta.code !== null,
    code: meta.code,
    phase,
    lastSyncAt: meta.lastSyncAt,
    lastError,
    pending: dirty,
  };
}

const sameStatus = (a: SyncStatus, b: SyncStatus): boolean =>
  a.linked === b.linked &&
  a.code === b.code &&
  a.phase === b.phase &&
  a.lastSyncAt === b.lastSyncAt &&
  a.lastError === b.lastError &&
  a.pending === b.pending;

const emitStatus = (): void => {
  const next = computeStatus();
  if (sameStatus(status, next)) return;
  status = next;
  for (const listener of listeners) listener();
};

// --- BroadcastChannel messaging ----------------------------------------------------------------

interface DirtyMessage {
  type: 'dirty';
}
interface StatusMessage {
  type: 'status';
  payload: { phase: SyncPhase; lastError: SyncErrorCode; pending: boolean };
}
interface RequestMessage {
  type: 'request';
}
type SyncMessage = DirtyMessage | StatusMessage | RequestMessage;

let channel: BroadcastChannel | null = null;

const postMessage = (message: SyncMessage): void => {
  try {
    channel?.postMessage(message);
  } catch {
    // channel closed mid-flight — ignore
  }
};

// Broadcast this tab's authoritative status to siblings. Only the leader broadcasts; followers
// mirror what they receive (and re-read the shared meta the leader just persisted).
const publishStatus = (): void => {
  emitStatus();
  if (isLeader) {
    postMessage({ type: 'status', payload: { phase, lastError, pending: dirty } });
  }
};

// --- lifecycle / leadership --------------------------------------------------------------------

let running = false;
let isLeader = false;
let hooksAttached = false;
let suppressed = false; // true while applyMerged writes, so our own hooks don't self-trigger
let resetSuppressed = false; // true during a local-only reset so clearAllProgress makes no tombstones
let mutationSeq = 0; // bumps on every not-yet-pushed mutation this tab knows about

let leaderAbort: AbortController | null = null;
let releaseLock: (() => void) | null = null;

let intervalTimer: ReturnType<typeof setInterval> | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let debounceFirstAt: number | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let loggedFailure = false;

const isVisible = (): boolean =>
  typeof document === 'undefined' || document.visibilityState !== 'hidden';

// Dirty detection: attach CRUD hooks to the 16 synced tables once. The body no-ops while
// suppressed (applyMerged) or while the engine is stopped. Exported for the focused unit test.
const attachDirtyDetection = (): void => {
  if (hooksAttached) return;
  hooksAttached = true;
  const onWrite = (): void => {
    if (suppressed) return;
    mutationSeq += 1;
    notifyDirty();
  };
  for (const name of SYNCED_TABLE_NAMES) {
    const table = db.table(name);
    table.hook('creating', onWrite);
    table.hook('updating', onWrite);
    table.hook('deleting', onWrite);
  }
  // Tombstone recording: on a genuine per-record delete of a tracked table, queue a tombstone so
  // the deletion propagates. Skipped while suppressed (applyMerged / restore) or reset-suppressed
  // (clearAllProgress), and while the engine is stopped (post-unlink deletes shouldn't accrue).
  for (const name of TOMBSTONE_TABLE_NAMES) {
    db.table(name).hook('deleting', (primKey: unknown) => {
      if (!running || suppressed || resetSuppressed) return;
      queueTombstone(name, primKey);
    });
  }
};

// A local mutation happened (or we were told one did). Mark pending and get it scheduled: the
// leader debounces a push; a follower pings the leader over the channel.
const notifyDirty = (): void => {
  if (!running) return;
  dirty = true;
  publishStatus();
  if (isLeader) scheduleDebounce();
  else postMessage({ type: 'dirty' });
};

const clearDebounce = (): void => {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  debounceFirstAt = null;
};

// 5s debounce with a 30s max-wait: coalesce a burst of edits into one push without starving a
// long, steady stream of edits.
const scheduleDebounce = (): void => {
  if (!running || !isLeader) return;
  const now = Date.now();
  if (debounceFirstAt === null) debounceFirstAt = now;
  const waited = now - debounceFirstAt;
  const delay = waited >= DEBOUNCE_MAX_WAIT_MS ? 0 : DEBOUNCE_MS;
  if (debounceTimer !== null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    debounceFirstAt = null;
    void syncCycle();
  }, delay);
};

const clearIntervalTimer = (): void => {
  if (intervalTimer !== null) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }
};

const clearRetryTimer = (): void => {
  if (retryTimer !== null) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
};

const nextBackoffMs = (): number => {
  const base = BACKOFF_MIN_MS + Math.random() * (BACKOFF_MAX_MS - BACKOFF_MIN_MS);
  return Math.round(base);
};

const scheduleRetry = (): void => {
  if (!running || !isLeader) return;
  clearRetryTimer();
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void syncCycle();
  }, nextBackoffMs());
};

const startIntervalTimer = (): void => {
  if (!isLeader) return;
  clearIntervalTimer();
  if (!isVisible()) return;
  intervalTimer = setInterval(() => void syncCycle(), PULL_INTERVAL_MS);
};

const becomeLeader = (): void => {
  isLeader = true;
  // Adopt any dirty state a follower reported before we won the lock.
  if (isVisible()) void syncCycle();
  startIntervalTimer();
  publishStatus();
};

const requestLeadership = (): void => {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!locks || typeof locks.request !== 'function') {
    // No Web Locks — every tab is its own leader. Safe: pushes use optimistic concurrency.
    becomeLeader();
    return;
  }
  leaderAbort = new AbortController();
  locks
    .request(
      LOCK_NAME,
      { signal: leaderAbort.signal },
      () =>
        new Promise<void>((resolve) => {
          releaseLock = resolve;
          becomeLeader();
        }),
    )
    .catch(() => {
      // AbortError when we stop before/while awaiting the lock — expected.
    });
};

const handleMessage = (event: MessageEvent<SyncMessage>): void => {
  const data = event.data;
  if (!data) return;
  if (data.type === 'dirty') {
    // A sibling tab edited the shared DB. The leader schedules a push on its behalf.
    if (isLeader) {
      mutationSeq += 1;
      dirty = true;
      publishStatus();
      scheduleDebounce();
    }
    return;
  }
  if (data.type === 'status') {
    // Follower mirrors the leader: adopt phase/error/pending, re-read the meta the leader
    // just persisted (lastSyncAt / code).
    reloadMeta();
    phase = data.payload.phase;
    lastError = data.payload.lastError;
    dirty = data.payload.pending;
    emitStatus();
    return;
  }
  // A newly opened tab asked for current status; the leader answers.
  if (data.type === 'request' && isLeader) {
    postMessage({ type: 'status', payload: { phase, lastError, pending: dirty } });
  }
};

const handleVisibility = (): void => {
  if (typeof document === 'undefined') return;
  if (document.visibilityState === 'hidden') {
    void flushOnHidden();
    if (isLeader) clearIntervalTimer();
    return;
  }
  if (!isLeader) return;
  startIntervalTimer();
  const staleFor = meta.lastSyncAt === null ? Infinity : Date.now() - meta.lastSyncAt;
  if (staleFor > VISIBLE_STALE_MS) void syncCycle();
};

const handlePageHide = (): void => {
  void flushOnHidden();
};

const start = (): void => {
  if (running || typeof window === 'undefined') return;
  running = true;
  isLeader = false;
  loggedFailure = false;
  attachDirtyDetection();

  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = handleMessage;
  } catch {
    channel = null;
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibility);
  }
  window.addEventListener('pagehide', handlePageHide);

  // Ask any existing leader for current status so a fresh tab shows state without a full cycle.
  postMessage({ type: 'request' });
  requestLeadership();
};

const stop = (): void => {
  running = false;
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibility);
  }
  if (typeof window !== 'undefined') {
    window.removeEventListener('pagehide', handlePageHide);
  }
  clearIntervalTimer();
  clearDebounce();
  clearRetryTimer();
  if (leaderAbort) {
    leaderAbort.abort();
    leaderAbort = null;
  }
  if (releaseLock) {
    releaseLock();
    releaseLock = null;
  }
  isLeader = false;
  if (channel) {
    channel.onmessage = null;
    channel.close();
    channel = null;
  }
};

// Stop the timers but keep the engine "running" (hooks live, meta intact) so the UI can show a
// terminal state such as not-found without the code being auto-unlinked.
const stopTimersOnly = (): void => {
  clearIntervalTimer();
  clearDebounce();
  clearRetryTimer();
};

// --- end-to-end encryption key (session cache) -------------------------------------------------

// The AES key is derived once per session from the linked code and cached in memory only — never
// persisted (the code in localStorage is already the secret). Re-derived when the linked code
// changes (link / reissue / unlink clear the cache).
let syncKey: CryptoKey | null = null;
let syncKeyCode: string | null = null;

const getSyncKey = async (): Promise<CryptoKey | null> => {
  const code = meta.code;
  if (!code) return null;
  if (syncKey && syncKeyCode === code) return syncKey;
  try {
    const key = await deriveSyncKey(code);
    syncKey = key;
    syncKeyCode = code;
    return key;
  } catch {
    return null; // no WebCrypto — fall back to the legacy plaintext codec path
  }
};

const clearSyncKey = (): void => {
  syncKey = null;
  syncKeyCode = null;
};

// Encode a snapshot for a server push: end-to-end-encrypted (DLS1) when a key is derivable and
// compression is available, otherwise the legacy plaintext blob (older clients / no WebCrypto).
const encodeForPush = async (json: string): Promise<string> => {
  const key = await getSyncKey();
  if (key && supportsCompression()) return encryptSnapshot(json, key);
  return encodeSnapshot(json);
};

// --- deletion tombstones -----------------------------------------------------------------------

// In-memory queue of deletions observed since the last flush. Persisted by flushPendingTombstones,
// which every push path awaits via buildLocalSnapshot (and flushOnHidden on tab close), so a
// deletion is durable before it can be pushed — no separate timer needed.
let pendingTombstones: SyncTombstoneRecord[] = [];

const queueTombstone = (table: string, primKey: unknown): void => {
  const recordKey = String(primKey);
  pendingTombstones.push({
    id: `${table}:${recordKey}`,
    table,
    recordKey,
    deletedAt: new Date().toISOString(),
  });
};

// Local housekeeping of the tombstone table: drop anything past the TTL, then cap to the newest N.
// Uses the wall clock (this is local storage reclamation, not the pure merge). Must run inside a
// syncTombstones rw transaction.
const pruneTombstoneTable = async (): Promise<void> => {
  const cutoff = Date.now() - TOMBSTONE_TTL_MS;
  const all = await db.syncTombstones.toArray();
  const stale = all.filter((t) => Date.parse(t.deletedAt) < cutoff).map((t) => t.id);
  if (stale.length > 0) await db.syncTombstones.bulkDelete(stale);
  const survivors = all.filter((t) => Date.parse(t.deletedAt) >= cutoff);
  if (survivors.length > TOMBSTONE_CAP) {
    survivors.sort((x, y) => Date.parse(x.deletedAt) - Date.parse(y.deletedAt)); // oldest first
    const overflow = survivors.slice(0, survivors.length - TOMBSTONE_CAP).map((t) => t.id);
    if (overflow.length > 0) await db.syncTombstones.bulkDelete(overflow);
  }
};

// Persists queued tombstones (upsert by id) and prunes. Best-effort: on failure the batch is
// re-queued for the next attempt. buildLocalSnapshot awaits this so a push never races a pending
// deletion.
const flushPendingTombstones = async (): Promise<void> => {
  if (pendingTombstones.length === 0) return;
  const batch = pendingTombstones;
  pendingTombstones = [];
  try {
    await db.transaction('rw', db.syncTombstones, async () => {
      await db.syncTombstones.bulkPut(batch);
      await pruneTombstoneTable();
    });
  } catch {
    pendingTombstones = batch.concat(pendingTombstones);
  }
};

// --- snapshot helpers --------------------------------------------------------------------------

const buildLocalSnapshot = async (): Promise<SyncSnapshot> => {
  await flushPendingTombstones();
  const exported = await exportProgress();
  const tombstones = await db.syncTombstones.toArray();
  const snapshot: SyncSnapshot = { ...exported, syncDeviceId: meta.deviceId };
  if (tombstones.length > 0) snapshot.tombstones = tombstones;
  return snapshot;
};

// Fingerprint of the *information* in a snapshot: the raw hash with the volatile top-level
// `exportedAt` neutralized and the per-device `syncDeviceId` dropped. Two devices holding equal
// data/settings produce equal fingerprints regardless of when they exported or which device tag
// they carry — this is what makes convergence terminate instead of ping-ponging pushes.
const dataFingerprint = (snapshot: SyncSnapshot): string => {
  const { syncDeviceId: _device, exportedAt: _exportedAt, ...rest } = snapshot;
  return snapshotHash({ ...rest, exportedAt: '' });
};

// snapshotHash's digest over an already-canonical string: lets a caller that holds the canonical
// serialization hash it without re-serializing (hashCanonical(canonicalStringify(x)) === snapshotHash(x)).
const hashCanonical = (json: string): string => {
  let h1 = 0x811c9dc5;
  let h2 = 0x1000193b | 0;
  for (let i = 0; i < json.length; i++) {
    const c = json.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193);
    h2 = Math.imul(h2 ^ c, 0x85ebca77);
  }
  const hex = (n: number): string => (n >>> 0).toString(16).padStart(8, '0');
  return hex(h1) + hex(h2);
};

const stripAttemptId = (rec: AttemptEventRecord): AttemptEventRecord => {
  const { id: _id, ...rest } = rec;
  return rest;
};
const stripCheckpointId = (rec: CheckpointResultRecord): CheckpointResultRecord => {
  const { id: _id, ...rest } = rec;
  return rest;
};

const byAtAsc = <T extends { at: string }>(a: T, b: T): number =>
  a.at < b.at ? -1 : a.at > b.at ? 1 : 0;

// Additively bulkPut a tombstone-tracked table, then delete the local rows the merge dropped: any
// local key absent from the merged output is a record a tombstone killed (the merge is otherwise a
// union, so a non-tombstoned local record is always present in `rows`). Runs while suppressed, so
// these deletes never queue new tombstones.
const applyTrackedTable = async <T extends { id: K }, K>(
  table: Table<T, K>,
  rows: readonly T[],
): Promise<void> => {
  const mergedKeys = new Set<K>(rows.map((r) => r.id));
  const localKeys = await table.toCollection().primaryKeys();
  const toDelete = localKeys.filter((k) => !mergedKeys.has(k));
  await table.bulkPut(rows as T[]);
  if (toDelete.length > 0) await table.bulkDelete(toDelete);
};

/**
 * Applies a merged snapshot to the local Dexie store in a single rw transaction.
 *   - Additive stable-key tables are bulkPut (last write wins by key).
 *   - Tombstone-tracked tables are bulkPut *and* have local rows the merge dropped deleted, so a
 *     propagated deletion actually removes the record here.
 *   - The two auto-increment tables (attemptEvents, checkpointResults) are cleared and re-added
 *     without an id in ascending `at` order, so freshly assigned ++ids follow chronological order.
 *   - The merged tombstone set is upserted locally (union) and pruned, so this device keeps
 *     propagating deletions and doesn't resurrect them on its next export.
 * Hook-based dirty/tombstone detection is suppressed for the duration so applying a remote merge
 * never re-triggers a local push or a spurious tombstone.
 *
 * Exported for the focused unit test; the engine also calls it internally.
 */
export const applyMerged = async (merged: SyncSnapshot): Promise<void> => {
  const d = merged.data;
  const attempts = [...(d.attemptEvents ?? [])].sort(byAtAsc).map(stripAttemptId);
  const checkpoints = [...(d.checkpointResults ?? [])].sort(byAtAsc).map(stripCheckpointId);
  const tombstones = merged.tombstones ?? [];
  suppressed = true;
  try {
    await db.transaction(
      'rw',
      [
        db.progress,
        db.activity,
        db.flashcardReviews,
        db.interviewStudied,
        db.topicPlace,
        db.conceptNotes,
        db.bookmarks,
        db.conceptRead,
        db.conceptScroll,
        db.highlights,
        db.attemptEvents,
        db.achievements,
        db.checkpointResults,
        db.examResults,
        db.userCards,
        db.reExamSchedule,
        db.syncTombstones,
      ],
      async () => {
        await db.progress.bulkPut(d.progress ?? []);
        await db.activity.bulkPut(d.activity ?? []);
        await db.flashcardReviews.bulkPut(d.flashcardReviews ?? []);
        await db.topicPlace.bulkPut(d.topicPlace ?? []);
        await db.conceptScroll.bulkPut(d.conceptScroll ?? []);
        await db.achievements.bulkPut(d.achievements ?? []);
        await db.examResults.bulkPut(d.examResults ?? []);
        await db.reExamSchedule.bulkPut(d.reExamSchedule ?? []);
        // Tombstone-tracked tables: additive put + delete locals the merge dropped.
        await applyTrackedTable(db.interviewStudied, d.interviewStudied ?? []);
        await applyTrackedTable(db.conceptNotes, d.conceptNotes ?? []);
        await applyTrackedTable(db.bookmarks, d.bookmarks ?? []);
        await applyTrackedTable(db.conceptRead, d.conceptRead ?? []);
        await applyTrackedTable(db.highlights, d.highlights ?? []);
        await applyTrackedTable(db.userCards, d.userCards ?? []);
        await db.attemptEvents.clear();
        if (attempts.length > 0) await db.attemptEvents.bulkAdd(attempts);
        await db.checkpointResults.clear();
        if (checkpoints.length > 0) await db.checkpointResults.bulkAdd(checkpoints);
        if (tombstones.length > 0) await db.syncTombstones.bulkPut(tombstones);
        await pruneTombstoneTable();
      },
    );
  } finally {
    suppressed = false;
  }
};

// Applies merged settings only when they differ from local (settings live outside Dexie, so they
// go through the settings.ts importer, not the transaction).
const applyMergedSettings = (local: SyncSnapshot, merged: SyncSnapshot): void => {
  const mergedSettings = merged.settings;
  if (!mergedSettings) return;
  if (JSON.stringify(mergedSettings) === JSON.stringify(local.settings)) return;
  importSettings(mergedSettings);
};

// --- status transition helpers -----------------------------------------------------------------

const setSyncing = (): void => {
  phase = 'syncing';
  publishStatus();
};

const finalizeSynced = (rev: number, fingerprint: string, token: number): void => {
  writeMeta({ lastRev: rev, lastPushedHash: fingerprint, lastSyncAt: Date.now() });
  lastError = null;
  phase = 'idle';
  loggedFailure = false;
  clearRetryTimer();
  // Only clear dirty if no new mutation arrived while the cycle ran; otherwise keep it pending
  // and schedule another push so the just-made edits aren't stranded.
  if (mutationSeq === token) {
    dirty = false;
  } else if (isLeader) {
    scheduleDebounce();
  }
  publishStatus();
};

const logFailureOnce = (message: string): void => {
  if (loggedFailure) return;
  loggedFailure = true;
  console.debug(`[sync] ${message}`);
};

const setOffline = (): void => {
  phase = 'offline';
  lastError = 'network';
  logFailureOnce('offline; retrying with backoff');
  publishStatus();
  scheduleRetry();
};

const setServerError = (): void => {
  phase = 'error';
  lastError = 'server';
  logFailureOnce('server error; retrying with backoff');
  publishStatus();
  scheduleRetry();
};

const setNotFound = (): void => {
  // Code deleted/expired server-side. Stop timers so we stop hammering a dead code, but keep the
  // meta so the UI can prompt the user to relink; do NOT auto-unlink.
  phase = 'error';
  lastError = 'not-found';
  stopTimersOnly();
  publishStatus();
};

const setConflictLoop = (): void => {
  phase = 'error';
  lastError = 'conflict-loop';
  publishStatus();
  // No retry scheduled: the next dirty event or the 5-min interval retries from a fresh pull.
};

const setTooLarge = (): void => {
  phase = 'too-large';
  lastError = 'too-large';
  publishStatus();
  // Engine stays alive; a future edit that shrinks the snapshot (or nothing) retries on interval.
};

const setUnsupported = (): void => {
  phase = 'error';
  lastError = 'unsupported';
  publishStatus();
};

const isNetworkError = (error: unknown): boolean => {
  if (error instanceof ApiError) return error.status === 0;
  return true; // a raw TypeError from fetch() means the request never reached the server
};

const handleCycleError = (error: unknown): void => {
  if (error instanceof ApiError && error.status === 404) {
    setNotFound();
    return;
  }
  if (isNetworkError(error)) {
    setOffline();
    return;
  }
  setServerError();
};

const handleDecodeError = (error: unknown): void => {
  if (error instanceof CodecError && error.code === 'unsupported') {
    setUnsupported();
    return;
  }
  // Corrupt blob or non-JSON payload — the server data is unusable; surface as a server error.
  setServerError();
};

const conflictRev = (error: unknown): number | null => {
  if (!(error instanceof ApiError)) return null;
  const parsed = SyncPushConflict.safeParse(error.details);
  return parsed.success ? parsed.data.currentRev : null;
};

const isConflict = (error: unknown): boolean => error instanceof ApiError && error.status === 409;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const conflictBackoffMs = (): number =>
  Math.round(
    CONFLICT_BACKOFF_MIN_MS + Math.random() * (CONFLICT_BACKOFF_MAX_MS - CONFLICT_BACKOFF_MIN_MS),
  );

// --- core cycle --------------------------------------------------------------------------------

const decodeRemote = async (blob: string): Promise<SyncSnapshot> => {
  const key = await getSyncKey();
  return JSON.parse(await decodeSyncBlob(blob, key)) as SyncSnapshot;
};

/**
 * Reconciles local state against a known server position.
 *   - `remote` null  => server reported no change since lastRev (changed:false path).
 *   - `remote` set   => decoded remote snapshot at `serverRev`.
 * Applies the merge locally when it changes local data, then pushes when the merge carries
 * information the server lacks. On a 409 it re-pulls at the raced rev, re-merges and recurses
 * (bounded by MAX_CONFLICT_RETRIES).
 */
const reconcile = async (
  code: string,
  serverRev: number,
  remote: SyncSnapshot | null,
  attempt: number,
): Promise<void> => {
  const token = mutationSeq;

  // Rev-unchanged pull with no local mutation: !dirty means the local fingerprint still equals
  // lastPushedHash, so there is nothing to build, merge, encode or push. Reuse it and finalize.
  const pushedHash = meta.lastPushedHash;
  if (remote === null && !dirty && pushedHash !== null) {
    finalizeSynced(serverRev, pushedHash, token);
    return;
  }

  const local = await buildLocalSnapshot();
  const localFp = dataFingerprint(local);

  const merged = remote ? mergeSnapshots(local, remote) : local;
  const mergedFp = remote ? dataFingerprint(merged) : localFp;
  const remoteFp = remote ? dataFingerprint(remote) : null;

  if (mergedFp !== localFp) {
    const localJson = canonicalStringify(local);
    await saveSyncBackup('pre-apply', hashCanonical(localJson), await encodeSnapshot(localJson));
    await applyMerged(merged);
    applyMergedSettings(local, merged);
  }

  const needPush =
    remoteFp === null ? dirty && localFp !== meta.lastPushedHash : mergedFp !== remoteFp;

  if (!needPush) {
    finalizeSynced(serverRev, mergedFp, token);
    return;
  }

  const blob = await encodeForPush(canonicalStringify(merged));
  if (blob.length > SYNC_BLOB_MAX_CHARS) {
    setTooLarge();
    return;
  }

  try {
    const res = await pushSync(code, serverRev, blob);
    finalizeSynced(res.rev, mergedFp, token);
  } catch (error) {
    if (!isConflict(error)) {
      handleCycleError(error);
      return;
    }
    if (attempt >= MAX_CONFLICT_RETRIES) {
      setConflictLoop();
      return;
    }
    await sleep(conflictBackoffMs());
    const raced = conflictRev(error);
    let rp: SyncPullOutput;
    try {
      rp = await pullSync(code, serverRev);
    } catch (pullError) {
      handleCycleError(pullError);
      return;
    }
    if (rp.changed) {
      let newRemote: SyncSnapshot;
      try {
        newRemote = await decodeRemote(rp.blob);
      } catch (decodeError) {
        handleDecodeError(decodeError);
        return;
      }
      await reconcile(code, rp.rev, newRemote, attempt + 1);
    } else {
      await reconcile(code, raced ?? rp.rev, null, attempt + 1);
    }
  }
};

const runSyncCycle = async (): Promise<void> => {
  const code = meta.code;
  if (!code) return;
  setSyncing();
  let pull: SyncPullOutput;
  try {
    pull = await pullSync(code, meta.lastRev);
  } catch (error) {
    handleCycleError(error);
    return;
  }
  try {
    if (pull.changed) {
      let remote: SyncSnapshot;
      try {
        remote = await decodeRemote(pull.blob);
      } catch (decodeError) {
        handleDecodeError(decodeError);
        return;
      }
      await reconcile(code, pull.rev, remote, 0);
    } else {
      await reconcile(code, pull.rev, null, 0);
    }
  } catch (error) {
    handleCycleError(error);
  }
};

// Single-flight: never run two cycles at once. A request that arrives mid-cycle is coalesced into
// exactly one follow-up run when the current cycle finishes.
let inFlight: Promise<void> | null = null;
let pendingRerun = false;
let rotating = false; // true while reissueCode swaps the code — cycles must not race the rotation

const syncCycle = (): Promise<void> => {
  if (rotating) return Promise.resolve();
  if (inFlight) {
    pendingRerun = true;
    return inFlight;
  }
  inFlight = (async () => {
    try {
      await runSyncCycle();
    } finally {
      inFlight = null;
      if (pendingRerun) {
        pendingRerun = false;
        void syncCycle();
      }
    }
  })();
  return inFlight;
};

// Best-effort push when the page is being hidden/unloaded, so "close phone, open laptop" loses no
// window. No pull, no merge, no meta update (the page may die before promises settle) — just get
// the current local snapshot to the server. keepalive lets a small push outlive the page.
const flushOnHidden = async (): Promise<void> => {
  const code = meta.code;
  if (!running || !code || !dirty) return;
  try {
    const local = await buildLocalSnapshot();
    if (dataFingerprint(local) === meta.lastPushedHash) return;
    const blob = await encodeForPush(canonicalStringify(local));
    if (blob.length > SYNC_BLOB_MAX_CHARS) return;
    await pushSync(code, meta.lastRev, blob, { keepalive: blob.length < KEEPALIVE_MAX_CHARS });
  } catch {
    // Unload path: a failure (including a 409 lost race) is reconciled by the next full cycle.
  }
};

// --- public API --------------------------------------------------------------------------------

/** Idempotent; call once at startup. No-op unless a code is already linked. */
export const startSyncEngine = (): void => {
  if (meta.code === null) return;
  start();
};

/** Mints a code server-side, links this device and does the initial sync. Returns the code. */
export const createAndLink = async (): Promise<string> => {
  const created = await createSyncCode();
  writeMeta({ code: created.code, lastRev: created.rev, lastPushedHash: null, lastSyncAt: null });
  start();
  dirty = true;
  mutationSeq += 1; // force the initial push of local state as rev 1
  publishStatus();
  await syncCycle();
  return created.code;
};

/** Normalizes + validates a user-entered code, links, backs up local, then full-syncs. */
export const linkWithCode = async (raw: string): Promise<void> => {
  const parsed = SyncCode.safeParse(normalizeSyncCode(raw));
  if (!parsed.success) throw new Error('invalid');
  const code = parsed.data;
  await linkSyncCode(code); // throws (404) on an unknown code — surfaced to the UI
  const local = await buildLocalSnapshot();
  await saveSyncBackup(
    'link',
    snapshotHash(local),
    await encodeSnapshot(canonicalStringify(local)),
  );
  writeMeta({ code, lastRev: 0, lastPushedHash: null, lastSyncAt: null });
  start();
  dirty = true;
  mutationSeq += 1;
  publishStatus();
  await syncCycle();
};

/** Manual full cycle. No-op if not linked. */
export const syncNow = async (): Promise<void> => {
  if (meta.code === null) return;
  if (!running) start();
  await syncCycle();
};

/** Unlink this device, optionally deleting the remote code (best effort, idempotent). */
export const unlink = async (opts: { deleteRemote: boolean }): Promise<void> => {
  const code = meta.code;
  stop();
  if (opts.deleteRemote && code) {
    try {
      await deleteSyncCode(code);
    } catch {
      // 404 / network — deletion is idempotent server-side; ignore
    }
  }
  writeMeta({ code: null, lastRev: 0, lastPushedHash: null, lastSyncAt: null });
  clearSyncKey();
  phase = 'idle';
  lastError = null;
  dirty = false;
  publishStatus();
};

/**
 * Rotates to a brand-new sync code. Mints a fresh code, pushes the current local snapshot to it
 * (encrypted with the NEW code's key, at baseRev 0), then retires the old code (best effort) and
 * swaps the local meta. The old code stops working immediately; other devices must relink with the
 * new one. Single-flight with the sync cycle: it blocks new cycles and waits for any in-flight one
 * before rotating. Returns the new canonical code.
 */
export const reissueCode = async (): Promise<string> => {
  const oldCode = meta.code;
  if (!oldCode) throw new Error('not-linked');
  rotating = true;
  try {
    if (inFlight) await inFlight;

    const created = await createSyncCode();
    const local = await buildLocalSnapshot();
    const json = canonicalStringify(local);

    // Encrypt with the NEW code's key (getSyncKey still caches the old code's key).
    let blob: string;
    try {
      const key = await deriveSyncKey(created.code);
      blob = supportsCompression() ? await encryptSnapshot(json, key) : await encodeSnapshot(json);
    } catch {
      blob = await encodeSnapshot(json);
    }
    if (blob.length > SYNC_BLOB_MAX_CHARS) {
      try {
        await deleteSyncCode(created.code);
      } catch {
        // best effort — the unused code expires on its own
      }
      throw new Error('too-large');
    }

    const pushed = await pushSync(created.code, 0, blob);

    // The new code is authoritative now; retire the old one (idempotent, best effort).
    try {
      await deleteSyncCode(oldCode);
    } catch {
      // 404 / network — ignore
    }

    clearSyncKey();
    writeMeta({
      code: created.code,
      lastRev: pushed.rev,
      lastPushedHash: dataFingerprint(local),
      lastSyncAt: Date.now(),
    });
    lastError = null;
    phase = 'idle';
    if (!running) start();
    publishStatus();
    return created.code;
  } finally {
    rotating = false;
  }
};

/**
 * Runs `fn` with tombstone recording suppressed, so genuine per-record deletes it performs do NOT
 * propagate. Used by the Settings "reset all progress" flow: clearAllProgress stays LOCAL-ONLY (the
 * server copy re-merges back on the next sync), so it must not emit deletion tombstones.
 */
export const suppressTombstonesDuring = async <T>(fn: () => Promise<T>): Promise<T> => {
  const previous = resetSuppressed;
  resetSuppressed = true;
  try {
    return await fn();
  } finally {
    resetSuppressed = previous;
  }
};

/** Rolls the local DB back to a syncBackups entry, then marks dirty so the next cycle re-merges. */
export const restoreBackup = async (id: number): Promise<void> => {
  const backup = await getSyncBackup(id);
  if (!backup) throw new Error('backup-not-found');
  const parsed = JSON.parse(await decodeSnapshot(backup.payload)) as unknown;
  suppressed = true; // pause dirty detection while we overwrite the whole store
  try {
    await clearAllProgress();
    await importProgress(parsed);
  } finally {
    suppressed = false;
  }
  // Treat the restore as a local mutation: the next cycle merges it upstream per additive rules.
  if (running) {
    notifyDirty();
  } else {
    dirty = true;
    mutationSeq += 1;
    publishStatus();
  }
};

// --- React hook --------------------------------------------------------------------------------

const subscribe = (onChange: () => void): (() => void) => {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
};

const getSnapshot = (): SyncStatus => status;
const getServerSnapshot = (): SyncStatus => DEFAULT_STATUS;

export const useSync = (): SyncStatus => {
  useEffect(() => {
    startSyncEngine();
  }, []);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
};

// --- HMR ---------------------------------------------------------------------------------------

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    stop();
  });
}

// Test-only internals. Kept minimal and clearly namespaced; not part of the public API.
export const __test = {
  applyMerged,
  attachDirtyDetection,
  dataFingerprint,
  reconcile,
  flushTombstones: flushPendingTombstones,
  getDirty: (): boolean => dirty,
  getMutationSeq: (): number => mutationSeq,
  setSuppressed: (value: boolean): void => {
    suppressed = value;
  },
  setRunning: (value: boolean): void => {
    running = value;
  },
  setResetSuppressed: (value: boolean): void => {
    resetSuppressed = value;
  },
  reset: (): void => {
    dirty = false;
    mutationSeq = 0;
    suppressed = false;
    resetSuppressed = false;
    pendingTombstones = [];
  },
};
