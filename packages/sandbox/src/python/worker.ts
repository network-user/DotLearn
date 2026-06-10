/// <reference lib="webworker" />

import { loadPyodide, type PyodideInterface } from 'pyodide';

import type { PyodideWorkerRequest, PyodideWorkerResponse } from './protocol';

const workerScope = self as unknown as DedicatedWorkerGlobalScope;

const rawPostMessage = workerScope.postMessage.bind(workerScope);

const DEFAULT_INDEX_URL = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/';

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

const hardenWorkerScope = (): void => {
  const scope = workerScope as unknown as Record<string, unknown>;
  for (const name of ESCAPE_GLOBALS) {
    try {
      Object.defineProperty(scope, name, {
        value: undefined,
        writable: false,
        configurable: false,
        enumerable: false,
      });
    } catch {
      try {
        scope[name] = undefined;
      } catch {
        // a non-configurable, non-writable global cannot be neutralized; ignore
      }
    }
  }
};

let pyodidePromise: Promise<PyodideInterface> | undefined;

const ensurePyodide = (indexUrl?: string): Promise<PyodideInterface> => {
  if (!pyodidePromise) {
    pyodidePromise = loadPyodide({ indexURL: indexUrl ?? DEFAULT_INDEX_URL }).then((py) => {
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
    py.runPython(STDOUT_HARNESS);
    let value: unknown;
    let thrown: { type: string; message: string } | undefined;
    try {
      py.runPython(source);
      value = py.runPython(call);
      value = toPlain(value);
    } catch (error) {
      thrown = {
        type: error instanceof Error ? error.name : 'PythonError',
        message: error instanceof Error ? error.message : String(error),
      };
    }
    const stdout = py.runPython(STDOUT_TEARDOWN) as string;
    post({
      id,
      type: 'result',
      value,
      stdout: capStdout(typeof stdout === 'string' ? stdout : String(stdout ?? '')),
      ...(thrown !== undefined ? { thrown } : {}),
    });
  } catch (error) {
    post({ id, type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};

workerScope.addEventListener('message', (event: MessageEvent<PyodideWorkerRequest>) => {
  const request = event.data;
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
