/// <reference lib="webworker" />

const ESCAPE_GLOBALS = [
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'WebSocketStream',
  'EventSource',
  'importScripts',
  'indexedDB',
  'caches',
  'Worker',
  'SharedWorker',
  'BroadcastChannel',
  'postMessage',
  // WebRTC and WebTransport open network channels that bypass a neutered fetch and are not
  // governed by the CSP connect-src directive, so they must be removed explicitly.
  'RTCPeerConnection',
  'webkitRTCPeerConnection',
  'WebTransport',
] as const;

// navigator.sendBeacon is a self-contained cross-origin POST that does not depend on the
// fetch global, so neutering fetch alone leaves an exfiltration channel open. serviceWorker
// is removed for the same defense-in-depth reason.
const ESCAPE_NAVIGATOR_METHODS = ['sendBeacon', 'serviceWorker', 'storage'] as const;

const CRITICAL_ESCAPE_GLOBALS = [
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'WebSocketStream',
  'importScripts',
  'indexedDB',
  'caches',
  'RTCPeerConnection',
  'WebTransport',
] as const;

export class WorkerScopeHardeningError extends Error {
  readonly survivors: readonly string[];

  constructor(survivors: readonly string[]) {
    super(`worker scope not hardened; survived neutering: ${survivors.join(', ')}`);
    this.name = 'WorkerScopeHardeningError';
    this.survivors = survivors;
  }
}

const neutralize = (target: Record<string, unknown>, name: string): void => {
  try {
    Object.defineProperty(target, name, {
      value: undefined,
      writable: false,
      configurable: false,
      enumerable: false,
    });
  } catch {
    try {
      target[name] = undefined;
    } catch {
      // a non-configurable, non-writable property cannot be neutralized; ignore
    }
  }
};

const assertWorkerScopeHardened = (
  target: Record<string, unknown>,
  navigator: Record<string, unknown> | undefined,
): void => {
  const survivors: string[] = [];
  for (const name of CRITICAL_ESCAPE_GLOBALS) {
    if (target[name] !== undefined) {
      survivors.push(name);
    }
  }
  if (navigator && navigator.storage !== undefined) {
    survivors.push('navigator.storage');
  }
  if (survivors.length > 0) {
    throw new WorkerScopeHardeningError(survivors);
  }
};

// Neutralizes the network/escape globals reachable from inside a sandbox worker, as
// defense-in-depth against data exfiltration from untrusted code. Callers must capture a
// reference to postMessage BEFORE invoking this (postMessage itself is neutered), and reply
// through that captured reference.
export const hardenWorkerScope = (scope: DedicatedWorkerGlobalScope): void => {
  const target = scope as unknown as Record<string, unknown>;
  for (const name of ESCAPE_GLOBALS) {
    neutralize(target, name);
  }
  const navigator = (target as { navigator?: Record<string, unknown> }).navigator;
  if (navigator) {
    for (const name of ESCAPE_NAVIGATOR_METHODS) {
      neutralize(navigator, name);
    }
  }
  assertWorkerScopeHardened(target, navigator);
};
