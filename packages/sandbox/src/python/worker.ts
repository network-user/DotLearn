/// <reference lib="webworker" />

import { loadPyodide, type PyodideInterface } from 'pyodide';

import { hardenWorkerScope } from '../harden-worker-scope';
import type { PyodideInitProgress, PyodideWorkerRequest, PyodideWorkerResponse } from './protocol';

const workerScope = self as unknown as DedicatedWorkerGlobalScope;

const rawPostMessage = workerScope.postMessage.bind(workerScope);

let pyodidePromise: Promise<PyodideInterface> | undefined;

const WASM_FILE = 'pyodide.asm.wasm';

// Pyodide packages that are NOT vendored in python_stdlib.zip and ship as separate
// .zip files (e.g. sqlite3, used by the python-orm topic). They MUST be loaded here
// during init, while fetch still works: hardenWorkerScope() neuters fetch/importScripts
// immediately after, so a runtime loadPackagesFromImports() can never download them and
// `import sqlite3` would fall back to the "unvendored" stub (ModuleNotFoundError).
// Mirror of PYODIDE_EXTRA_PACKAGES in apps/web/vite.config.ts, which makes sure the .zip
// is actually served to the browser.
const PRELOAD_PACKAGES = ['sqlite3'] as const;

const prefetchRuntimeBinary = async (
  indexUrl: string,
  onProgress: (progress: PyodideInitProgress) => void,
): Promise<void> => {
  const base = indexUrl.endsWith('/') ? indexUrl : `${indexUrl}/`;
  const response = await fetch(`${base}${WASM_FILE}`);
  if (!response.ok || !response.body) {
    return;
  }
  const totalHeader = response.headers.get('content-length');
  const totalBytes = totalHeader ? Number.parseInt(totalHeader, 10) || 0 : 0;
  const reader = response.body.getReader();
  let loadedBytes = 0;
  onProgress({ phase: 'download', loadedBytes: 0, totalBytes });
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    loadedBytes += value?.byteLength ?? 0;
    onProgress({ phase: 'download', loadedBytes, totalBytes });
  }
  onProgress({ phase: 'boot', loadedBytes, totalBytes: loadedBytes });
};

const ensurePyodide = (
  indexUrl: string | undefined,
  onProgress: (progress: PyodideInitProgress) => void,
): Promise<PyodideInterface> => {
  if (!pyodidePromise) {
    if (!indexUrl) {
      return Promise.reject(
        new Error('Pyodide index URL is required; refusing to fall back to a remote CDN.'),
      );
    }
    pyodidePromise = (async () => {
      await prefetchRuntimeBinary(indexUrl, onProgress).catch(() => undefined);
      const py = await loadPyodide({ indexURL: indexUrl });
      // Load curated packages while the network is still reachable. Best-effort: a failed
      // preload (e.g. offline) must not take down the whole Python sandbox — only the
      // topics that need that package break, and they would anyway.
      if (PRELOAD_PACKAGES.length > 0) {
        await py
          .loadPackage([...PRELOAD_PACKAGES], { messageCallback: () => undefined })
          .catch(() => undefined);
      }
      hardenWorkerScope(workerScope);
      return py;
    })();
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
    const proxy = value as {
      toJs: (options?: { dict_converter?: unknown }) => unknown;
      destroy?: () => void;
    };
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

const noopProgress = (): void => undefined;

const runEvaluate = async (id: string, source: string, call: string): Promise<void> => {
  try {
    const py = await ensurePyodide(undefined, noopProgress);
    // Each evaluation runs in a fresh globals namespace so definitions, imports and any
    // __builtins__ monkeypatching from one run cannot leak into a later grading run.
    const namespace = py.toPy({});
    const options = { globals: namespace };
    try {
      py.runPython(STDOUT_HARNESS, options);
      let value: unknown;
      let thrown: { type: string; message: string } | undefined;
      try {
        await py.loadPackagesFromImports(source);
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
    const reportProgress = (progress: PyodideInitProgress): void => {
      post({ id: request.id, type: 'init-progress', progress });
    };
    ensurePyodide(request.indexUrl, reportProgress)
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
