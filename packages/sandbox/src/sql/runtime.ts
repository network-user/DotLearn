import { SqlExecutionError, type SqlExecution, type SqlRuntime } from '@dotlearn/lesson-engine';

import type { SqlWorkerRequest, SqlWorkerResponse } from './protocol';

export interface SqlJsRuntimeOptions {
  createWorker: () => Worker;
  wasmUrl?: string;
  timeoutMs?: number;
  initTimeoutMs?: number;
}

export interface SqlJsRuntime extends SqlRuntime {
  init(): Promise<void>;
  terminate(): void;
}

interface PendingResolver {
  resolve(response: SqlWorkerResponse): void;
  reject(error: Error): void;
  timer?: ReturnType<typeof setTimeout>;
}

const DEFAULT_TIMEOUT_MS = 5_000;
// The sql.js wasm is tiny and bundled same-origin, so a stalled init is a fault, not a slow
// download. A much lower ceiling than Pyodide's 120s is appropriate.
const DEFAULT_INIT_TIMEOUT_MS = 30_000;

let idCounter = 0;
const nextId = (): string => {
  idCounter += 1;
  return `sql-${idCounter}`;
};

export const createSqlJsRuntime = (options: SqlJsRuntimeOptions): SqlJsRuntime => {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const initTimeoutMs = options.initTimeoutMs ?? DEFAULT_INIT_TIMEOUT_MS;
  const pending = new Map<string, PendingResolver>();

  let worker: Worker | undefined;
  let initPromise: Promise<void> | undefined;
  let initWatchdog: ReturnType<typeof setTimeout> | undefined;

  const clearInitWatchdog = (): void => {
    if (initWatchdog !== undefined) {
      clearTimeout(initWatchdog);
      initWatchdog = undefined;
    }
  };

  const armInitWatchdog = (): void => {
    clearInitWatchdog();
    initWatchdog = setTimeout(() => {
      // A stalled initSqlJs would otherwise wedge SQL exercises forever with no recovery.
      // Mirror the Python runtime: abort and rebuild the worker on the next call.
      disposeWorker(new SqlExecutionError(`sql runtime init stalled for ${initTimeoutMs}ms`, ''), {
        warmReinit: false,
      });
    }, initTimeoutMs);
  };

  const onMessage = (event: MessageEvent<SqlWorkerResponse>): void => {
    const response = event.data;
    const resolver = pending.get(response.id);
    if (!resolver) {
      return;
    }
    pending.delete(response.id);
    if (resolver.timer !== undefined) {
      clearTimeout(resolver.timer);
    }
    resolver.resolve(response);
  };

  const disposeWorker = (error: Error, options?: { warmReinit?: boolean }): void => {
    clearInitWatchdog();
    if (worker) {
      worker.removeEventListener('message', onMessage);
      worker.removeEventListener('error', onError);
      worker.terminate();
      worker = undefined;
    }
    initPromise = undefined;
    for (const resolver of pending.values()) {
      if (resolver.timer !== undefined) {
        clearTimeout(resolver.timer);
      }
      resolver.reject(error);
    }
    pending.clear();
    if (options?.warmReinit !== false) {
      void init().catch(() => undefined);
    }
  };

  function onError(event: ErrorEvent): void {
    disposeWorker(new SqlExecutionError(event.message || 'sql worker crashed', ''), {
      warmReinit: false,
    });
  }

  const ensureWorker = (): Worker => {
    if (!worker) {
      worker = options.createWorker();
      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onError);
    }
    return worker;
  };

  const send = (
    request: SqlWorkerRequest,
    timeout: number | undefined,
  ): Promise<SqlWorkerResponse> =>
    new Promise<SqlWorkerResponse>((resolve, reject) => {
      const activeWorker = ensureWorker();
      const resolver: PendingResolver = { resolve, reject };
      if (timeout !== undefined) {
        resolver.timer = setTimeout(() => {
          pending.delete(request.id);
          disposeWorker(
            new SqlExecutionError(`sql execution exceeded ${timeout}ms and was terminated`, ''),
            { warmReinit: false },
          );
        }, timeout);
      }
      pending.set(request.id, resolver);
      activeWorker.postMessage(request);
    });

  const buildInitRequest = (): SqlWorkerRequest =>
    options.wasmUrl !== undefined
      ? { id: nextId(), type: 'init', wasmUrl: options.wasmUrl }
      : { id: nextId(), type: 'init' };

  const init = (): Promise<void> => {
    if (!initPromise) {
      armInitWatchdog();
      initPromise = send(buildInitRequest(), undefined)
        .then((response) => {
          clearInitWatchdog();
          if (response.type === 'error') {
            throw new SqlExecutionError(response.message, '');
          }
        })
        .catch((error: unknown) => {
          clearInitWatchdog();
          throw error instanceof SqlExecutionError
            ? error
            : new SqlExecutionError(String(error), '');
        });
    }
    return initPromise;
  };

  const execute = async (sql: string, fixture?: string): Promise<SqlExecution> => {
    await init();
    const request: SqlWorkerRequest =
      fixture !== undefined
        ? { id: nextId(), type: 'execute', sql, fixture }
        : { id: nextId(), type: 'execute', sql };
    const response = await send(request, timeoutMs);
    if (response.type === 'error') {
      throw new SqlExecutionError(response.message, sql);
    }
    if (response.type !== 'result') {
      throw new SqlExecutionError(`unexpected worker response: ${response.type}`, sql);
    }
    return response.truncated
      ? { columns: response.columns, rows: response.rows, truncated: true }
      : { columns: response.columns, rows: response.rows };
  };

  const terminate = (): void => {
    disposeWorker(new SqlExecutionError('sql runtime terminated', ''), { warmReinit: false });
  };

  return { init, execute, terminate };
};
