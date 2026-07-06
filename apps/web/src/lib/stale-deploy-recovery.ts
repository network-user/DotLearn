const RELOAD_GUARD_KEY = 'dotlearn:stale-chunk-reload';

/**
 * A redeploy rotates hashed chunk filenames. A client still running an older
 * `index.html` (often one held by the service worker precache) then 404s when it
 * tries to `import()` a chunk whose hash no longer exists on the server. Dropping
 * the service worker + Cache Storage forces the next navigation to fetch a fresh
 * `index.html` and the current chunk names. User data lives in IndexedDB, which is
 * left untouched.
 *
 * Guarded to run at most once per tab session so a genuinely missing chunk cannot
 * spin an infinite reload loop. Pass `force` for an explicit, user-initiated retry
 * (the error-boundary button), which should always act.
 */
export async function recoverFromStaleChunk(options: { force?: boolean } = {}): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  if (!options.force) {
    try {
      if (sessionStorage.getItem(RELOAD_GUARD_KEY)) {
        return;
      }
      sessionStorage.setItem(RELOAD_GUARD_KEY, '1');
    } catch {
      // sessionStorage can throw in private mode; recover anyway.
    }
  }

  await dropServiceWorkerAndCaches();
  window.location.reload();
}

async function dropServiceWorkerAndCaches(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
  } catch {
    // best effort — reload regardless.
  }

  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // best effort — reload regardless.
  }
}
