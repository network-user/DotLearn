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
} from '../progress-db';
import { clearAllProgress, exportProgress, importProgress } from '../progress-io';
import { importSettings } from '../settings';

import { CodecError, decodeSnapshot, encodeSnapshot } from './codec';
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

// --- snapshot helpers --------------------------------------------------------------------------

const buildLocalSnapshot = async (): Promise<SyncSnapshot> => {
  const exported = await exportProgress();
  return { ...exported, syncDeviceId: meta.deviceId };
};

// Fingerprint of the *information* in a snapshot: the raw hash with the volatile top-level
// `exportedAt` neutralized and the per-device `syncDeviceId` dropped. Two devices holding equal
// data/settings produce equal fingerprints regardless of when they exported or which device tag
// they carry — this is what makes convergence terminate instead of ping-ponging pushes.
const dataFingerprint = (snapshot: SyncSnapshot): string => {
  const { syncDeviceId: _device, exportedAt: _exportedAt, ...rest } = snapshot;
  return snapshotHash({ ...rest, exportedAt: '' });
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

/**
 * Applies a merged snapshot to the local Dexie store in a single rw transaction. The 14
 * stable-key tables are bulkPut (last write wins by key); the two auto-increment tables
 * (attemptEvents, checkpointResults) are cleared and re-added *without* an id in ascending `at`
 * order, so freshly assigned ++ids follow chronological order. Hook-based dirty detection is
 * suppressed for the duration so applying a remote merge never re-triggers a local push.
 *
 * Exported for the focused unit test; the engine also calls it internally.
 */
export const applyMerged = async (merged: SyncSnapshot): Promise<void> => {
  const d = merged.data;
  const attempts = [...(d.attemptEvents ?? [])].sort(byAtAsc).map(stripAttemptId);
  const checkpoints = [...(d.checkpointResults ?? [])].sort(byAtAsc).map(stripCheckpointId);
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
      ],
      async () => {
        await db.progress.bulkPut(d.progress ?? []);
        await db.activity.bulkPut(d.activity ?? []);
        await db.flashcardReviews.bulkPut(d.flashcardReviews ?? []);
        await db.interviewStudied.bulkPut(d.interviewStudied ?? []);
        await db.topicPlace.bulkPut(d.topicPlace ?? []);
        await db.conceptNotes.bulkPut(d.conceptNotes ?? []);
        await db.bookmarks.bulkPut(d.bookmarks ?? []);
        await db.conceptRead.bulkPut(d.conceptRead ?? []);
        await db.conceptScroll.bulkPut(d.conceptScroll ?? []);
        await db.highlights.bulkPut(d.highlights ?? []);
        await db.achievements.bulkPut(d.achievements ?? []);
        await db.examResults.bulkPut(d.examResults ?? []);
        await db.userCards.bulkPut(d.userCards ?? []);
        await db.reExamSchedule.bulkPut(d.reExamSchedule ?? []);
        await db.attemptEvents.clear();
        if (attempts.length > 0) await db.attemptEvents.bulkAdd(attempts);
        await db.checkpointResults.clear();
        if (checkpoints.length > 0) await db.checkpointResults.bulkAdd(checkpoints);
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

const decodeRemote = async (blob: string): Promise<SyncSnapshot> =>
  JSON.parse(await decodeSnapshot(blob)) as SyncSnapshot;

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
  const local = await buildLocalSnapshot();
  const localFp = dataFingerprint(local);

  const merged = remote ? mergeSnapshots(local, remote) : local;
  const mergedFp = remote ? dataFingerprint(merged) : localFp;
  const remoteFp = remote ? dataFingerprint(remote) : null;

  if (mergedFp !== localFp) {
    await saveSyncBackup(
      'pre-apply',
      snapshotHash(local),
      await encodeSnapshot(canonicalStringify(local)),
    );
    await applyMerged(merged);
    applyMergedSettings(local, merged);
  }

  const needPush =
    remoteFp === null ? dirty && localFp !== meta.lastPushedHash : mergedFp !== remoteFp;

  if (!needPush) {
    finalizeSynced(serverRev, mergedFp, token);
    return;
  }

  const blob = await encodeSnapshot(canonicalStringify(merged));
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

const syncCycle = (): Promise<void> => {
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
    const blob = await encodeSnapshot(canonicalStringify(local));
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
  phase = 'idle';
  lastError = null;
  dirty = false;
  publishStatus();
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
  getDirty: (): boolean => dirty,
  getMutationSeq: (): number => mutationSeq,
  setSuppressed: (value: boolean): void => {
    suppressed = value;
  },
  reset: (): void => {
    dirty = false;
    mutationSeq = 0;
    suppressed = false;
  },
};
