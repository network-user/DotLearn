/// <reference lib="webworker" />

import { loadPyodide, type PyodideInterface } from 'pyodide';

import type { PyodideWorkerRequest, PyodideWorkerResponse } from './protocol';

const workerScope = self as unknown as DedicatedWorkerGlobalScope;

const rawPostMessage = workerScope.postMessage.bind(workerScope);

const ESCAPE_GLOBALS = [
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'importScripts',
  'indexedDB',
  'caches',
  'Worker',
  'SharedWorker',
  'BroadcastChannel',
  'postMessage',
] as const;

// navigator.sendBeacon is a self-contained cross-origin POST that does not depend on the
// fetch global, so neutering fetch alone leaves an exfiltration channel open. serviceWorker
// is removed for the same defense-in-depth reason.
const ESCAPE_NAVIGATOR_METHODS = ['sendBeacon', 'serviceWorker'] as const;

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

const hardenWorkerScope = (): void => {
  const scope = workerScope as unknown as Record<string, unknown>;
  for (const name of ESCAPE_GLOBALS) {
    neutralize(scope, name);
  }
  const navigator = (scope as { navigator?: Record<string, unknown> }).navigator;
  if (navigator) {
    for (const name of ESCAPE_NAVIGATOR_METHODS) {
      neutralize(navigator, name);
    }
  }
};

let pyodidePromise: Promise<PyodideInterface> | undefined;

const ensurePyodide = (indexUrl?: string): Promise<PyodideInterface> => {
  if (!pyodidePromise) {
    if (!indexUrl) {
      return Promise.reject(
        new Error('Pyodide index URL is required; refusing to fall back to a remote CDN.'),
      );
    }
    pyodidePromise = loadPyodide({ indexURL: indexUrl }).then((py) => {
      hardenWorkerScope();
      return py;
    });
  }
  return pyodidePromise;
};

const post = (response: PyodideWorkerResponse): void => {
  rawPostMessage(response);
};

const MAX_STDOUT_CHARS = 100_000;

const STDOUT_HARNESS = `
import io as _dotlearn_io, sys as _dotlearn_sys
_dotlearn_stdout = _dotlearn_io.StringIO()
_dotlearn_sys.stdout = _dotlearn_stdout
`;

const STDOUT_TEARDOWN = `
_dotlearn_value = _dotlearn_stdout.getvalue()[:${MAX_STDOUT_CHARS + 1}]
_dotlearn_sys.stdout = _dotlearn_sys.__stdout__
_dotlearn_value
`;

const capStdout = (raw: string): string =>
  raw.length > MAX_STDOUT_CHARS
    ? `${raw.slice(0, MAX_STDOUT_CHARS)}\n... [output truncated at ${MAX_STDOUT_CHARS} characters]`
    : raw;

const toPlain = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'object' && value !== null && 'toJs' in value) {
    const proxy = value as { toJs: (options?: { dict_converter?: unknown }) => unknown; destroy?: () => void };
    try {
      const converted = proxy.toJs({ dict_converter: Object.fromEntries });
      proxy.destroy?.();
      return converted;
    } catch {
      return String(value);
    }
  }
  return value;
};

const runEvaluate = async (id: string, source: string, call: string): Promise<void> => {
  try {
    const py = await ensurePyodide();
    // Each evaluation runs in a fresh globals namespace so definitions, imports and any
    // __builtins__ monkeypatching from one run cannot leak into a later grading run.
    const namespace = py.toPy({});
    const options = { globals: namespace };
    try {
      py.runPython(STDOUT_HARNESS, options);
      let value: unknown;
      let thrown: { type: string; message: string } | undefined;
      try {
        py.runPython(source, options);
        value = toPlain(py.runPython(call, options));
      } catch (error) {
        thrown = {
          type: error instanceof Error ? error.name : 'PythonError',
          message: error instanceof Error ? error.message : String(error),
        };
      }
      const stdout = py.runPython(STDOUT_TEARDOWN, options) as string;
      post({
        id,
        type: 'result',
        value,
        stdout: capStdout(typeof stdout === 'string' ? stdout : String(stdout ?? '')),
        ...(thrown !== undefined ? { thrown } : {}),
      });
    } finally {
      (namespace as { destroy?: () => void }).destroy?.();
    }
  } catch (error) {
    post({ id, type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};

const isWorkerRequest = (data: unknown): data is PyodideWorkerRequest => {
  if (typeof data !== 'object' || data === null) return false;
  const request = data as Record<string, unknown>;
  if (typeof request.id !== 'string') return false;
  if (request.type === 'init') {
    return request.indexUrl === undefined || typeof request.indexUrl === 'string';
  }
  if (request.type === 'evaluate') {
    return typeof request.source === 'string' && typeof request.call === 'string';
  }
  return false;
};

workerScope.addEventListener('message', (event: MessageEvent<PyodideWorkerRequest>) => {
  const request = event.data;
  if (!isWorkerRequest(request)) {
    return;
  }
  if (request.type === 'init') {
    ensurePyodide(request.indexUrl)
      .then(() => post({ id: request.id, type: 'ready' }))
      .catch((error: unknown) =>
        post({
          id: request.id,
          type: 'error',
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    return;
  }
  if (request.type === 'evaluate') {
    void runEvaluate(request.id, request.source, request.call);
  }
});
