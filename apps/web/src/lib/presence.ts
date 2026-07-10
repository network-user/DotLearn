import { useEffect, useSyncExternalStore } from 'react';

import { sendPresenceBeat, type PresenceBeatResult } from './api-client';

/**
 * Anonymous online counter — client side.
 *
 * Design:
 * - A per-tab daily anonymous UUID (rotated at UTC midnight) is the only identity.
 *   No fingerprinting; the server deduplicates by this id.
 * - Exactly one tab is the "leader" (chosen via Web Locks) and beats every 30s,
 *   broadcasting the result to sibling tabs over a BroadcastChannel. Without Web
 *   Locks every tab beats itself (the server dedupes by id, so this is safe).
 * - The widget is fully optional: if the API is unreachable the shared state
 *   becomes null (the indicator renders nothing) and beats retry with backoff.
 * - A leader hidden for longer than HIDDEN_GRACE_MS stops beating so background
 *   tabs don't linger as "online"; it resumes immediately when made visible.
 */

export type PresenceState = { online: number; uniquesToday: number } | null;

const ID_KEY = 'dotlearn:presence-id';
const LOCK_NAME = 'dotlearn-presence-leader';
const CHANNEL_NAME = 'dotlearn-presence';

const BEAT_INTERVAL_MS = 30_000;
const BACKOFF_MIN_MS = 60_000;
const BACKOFF_MAX_MS = 120_000;
const HIDDEN_GRACE_MS = 5 * 60_000;

const utcDay = (): string => new Date().toISOString().slice(0, 10);

/** Read (or mint) today's anonymous id. A new UTC day means a fresh id. */
const getDailyId = (): string => {
  const day = utcDay();
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(ID_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { id?: unknown; day?: unknown };
        if (parsed.day === day && typeof parsed.id === 'string' && parsed.id) {
          return parsed.id;
        }
      }
    } catch {
      // fall through to mint a new id
    }
  }
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(ID_KEY, JSON.stringify({ id, day }));
    } catch {
      // storage unavailable (private mode); id lives only for this session
    }
  }
  return id;
};

// --- Shared state store (useSyncExternalStore) ---

let state: PresenceState = null;
const listeners = new Set<() => void>();

const sameState = (a: PresenceState, b: PresenceState): boolean => {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return a.online === b.online && a.uniquesToday === b.uniquesToday;
};

const setState = (next: PresenceState): void => {
  if (sameState(state, next)) return;
  state = next;
  for (const listener of listeners) listener();
};

// --- Controller (single instance, ref-counted by mounted hooks) ---

let refCount = 0;
let running = false;

let channel: BroadcastChannel | null = null;
let leaderAbort: AbortController | null = null;
let releaseLock: (() => void) | null = null;
let isLeader = false;

let beatTimer: ReturnType<typeof setTimeout> | null = null;
let consecutiveFailures = 0;
let hiddenSince: number | null = null;
let loggedFailure = false;

interface PresenceMessage {
  type: 'state' | 'request';
  payload?: PresenceState;
}

const publish = (next: PresenceState): void => {
  setState(next);
  try {
    channel?.postMessage({ type: 'state', payload: next } satisfies PresenceMessage);
  } catch {
    // channel closed mid-flight; ignore
  }
};

const clearBeatTimer = (): void => {
  if (beatTimer !== null) {
    clearTimeout(beatTimer);
    beatTimer = null;
  }
};

const scheduleNextBeat = (ms: number): void => {
  if (!running) return;
  clearBeatTimer();
  beatTimer = setTimeout(() => {
    beatTimer = null;
    void beatOnce();
  }, ms);
};

const nextBackoffMs = (): number => {
  // First failure waits BACKOFF_MIN, later ones BACKOFF_MAX; ±15% jitter so
  // many clients recovering at once don't hammer the server in lockstep.
  const base = consecutiveFailures <= 1 ? BACKOFF_MIN_MS : BACKOFF_MAX_MS;
  const jitter = base * 0.15 * (Math.random() * 2 - 1);
  return Math.round(base + jitter);
};

const isHiddenTooLong = (): boolean =>
  hiddenSince !== null && Date.now() - hiddenSince > HIDDEN_GRACE_MS;

const beatOnce = async (): Promise<void> => {
  if (!running) return;
  // A leader hidden for a long time stops registering itself as online.
  if (isHiddenTooLong()) {
    scheduleNextBeat(BEAT_INTERVAL_MS);
    return;
  }
  try {
    const result: PresenceBeatResult = await sendPresenceBeat(getDailyId());
    consecutiveFailures = 0;
    loggedFailure = false;
    publish({ online: result.online, uniquesToday: result.uniquesToday });
    scheduleNextBeat(BEAT_INTERVAL_MS);
  } catch {
    consecutiveFailures += 1;
    publish(null);
    if (!loggedFailure) {
      loggedFailure = true;
      // Single debug line only — a down/absent API must not spam the console.
      console.debug('[presence] beat failed; retrying with backoff');
    }
    scheduleNextBeat(nextBackoffMs());
  }
};

const startBeatLoop = (): void => {
  if (!running || beatTimer !== null) return;
  void beatOnce(); // first beat immediately, so the counter appears fast
};

const requestLeadership = (): void => {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!locks || typeof locks.request !== 'function') {
    // Fallback: no Web Locks — this tab beats on its own.
    isLeader = true;
    startBeatLoop();
    return;
  }
  leaderAbort = new AbortController();
  locks
    .request(
      LOCK_NAME,
      { signal: leaderAbort.signal },
      () =>
        // Holding the lock keeps this promise pending until we release it,
        // so exactly one tab runs the beat loop at a time.
        new Promise<void>((resolve) => {
          isLeader = true;
          releaseLock = resolve;
          startBeatLoop();
        }),
    )
    .catch(() => {
      // AbortError when we stop before/while waiting for the lock — expected.
    });
};

const handleMessage = (event: MessageEvent<PresenceMessage>): void => {
  const data = event.data;
  if (!data) return;
  if (data.type === 'state') {
    setState(data.payload ?? null);
    return;
  }
  // A newly opened tab asked for the current value; answer if we have one.
  if (data.type === 'request' && isLeader && state !== null) {
    try {
      channel?.postMessage({ type: 'state', payload: state } satisfies PresenceMessage);
    } catch {
      // ignore
    }
  }
};

const handleVisibility = (): void => {
  if (typeof document === 'undefined') return;
  if (document.visibilityState === 'hidden') {
    if (hiddenSince === null) hiddenSince = Date.now();
    return;
  }
  const wasHiddenLong = isHiddenTooLong();
  hiddenSince = null;
  if (wasHiddenLong && isLeader) {
    clearBeatTimer();
    void beatOnce(); // resume immediately on return to visibility
  }
};

const start = (): void => {
  if (running || typeof window === 'undefined') return;
  running = true;
  isLeader = false;
  consecutiveFailures = 0;
  loggedFailure = false;
  hiddenSince =
    typeof document !== 'undefined' && document.visibilityState === 'hidden' ? Date.now() : null;

  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = handleMessage;
  } catch {
    channel = null;
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibility);
  }

  // Ask any existing leader for the current value so we don't wait a full beat.
  try {
    channel?.postMessage({ type: 'request' } satisfies PresenceMessage);
  } catch {
    // ignore
  }

  requestLeadership();
};

const stop = (): void => {
  running = false;
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', handleVisibility);
  }
  clearBeatTimer();
  if (leaderAbort) {
    leaderAbort.abort();
    leaderAbort = null;
  }
  if (releaseLock) {
    releaseLock(); // release the Web Lock so another tab can take over
    releaseLock = null;
  }
  isLeader = false;
  if (channel) {
    channel.onmessage = null;
    channel.close();
    channel = null;
  }
};

const acquire = (): void => {
  refCount += 1;
  if (refCount === 1) start();
};

const relinquish = (): void => {
  refCount = Math.max(0, refCount - 1);
  if (refCount === 0) stop();
};

// Prevent leaked timers/locks/channels across Vite HMR module replacement.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    refCount = 0;
    stop();
  });
}

// --- React hook ---

const subscribe = (onChange: () => void): (() => void) => {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
};

const getSnapshot = (): PresenceState => state;
const getServerSnapshot = (): PresenceState => null;

export const usePresence = (): PresenceState => {
  useEffect(() => {
    acquire();
    return () => relinquish();
  }, []);
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
};
