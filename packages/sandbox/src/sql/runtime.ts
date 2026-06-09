import { SqlExecutionError, type SqlExecution, type SqlRuntime } from '@dotlearn/lesson-engine';

import type { SqlWorkerRequest, SqlWorkerResponse } from './protocol';

export interface SqlJsRuntimeOptions {
  worker: Worker;
  wasmUrl?: string;
}

export interface SqlJsRuntime extends SqlRuntime {
  init(): Promise<void>;
  terminate(): void;
}

interface PendingResolver {
  resolve(response: SqlWorkerResponse): void;
  reject(error: Error): void;
}

let idCounter = 0;
const nextId = (): string => {
  idCounter += 1;
  return `sql-${idCounter}`;
};

export const createSqlJsRuntime = (options: SqlJsRuntimeOptions): SqlJsRuntime => {
  const { worker } = options;
  const pending = new Map<string, PendingResolver>();

  const onMessage = (event: MessageEvent<SqlWorkerResponse>): void => {
    const response = event.data;
    const resolver = pending.get(response.id);
    if (!resolver) {
      return;
    }
    pending.delete(response.id);
    resolver.resolve(response);
  };

  const onError = (event: ErrorEvent): void => {
    const error = new Error(event.message || 'sql worker crashed');
    for (const resolver of pending.values()) {
      resolver.reject(error);
    }
    pending.clear();
  };

  worker.addEventListener('message', onMessage);
  worker.addEventListener('error', onError);

  const send = (request: SqlWorkerRequest): Promise<SqlWorkerResponse> =>
    new Promise<SqlWorkerResponse>((resolve, reject) => {
      pending.set(request.id, { resolve, reject });
      worker.postMessage(request);
    });

  let initPromise: Promise<void> | undefined;

  const buildInitRequest = (): SqlWorkerRequest =>
    options.wasmUrl !== undefined
      ? { id: nextId(), type: 'init', wasmUrl: options.wasmUrl }
      : { id: nextId(), type: 'init' };

  const init = (): Promise<void> => {
    if (!initPromise) {
      initPromise = send(buildInitRequest()).then((response) => {
        if (response.type === 'error') {
          throw new SqlExecutionError(response.message, '');
        }
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
    const response = await send(request);
    if (response.type === 'error') {
      throw new SqlExecutionError(response.message, sql);
    }
    if (response.type !== 'result') {
      throw new SqlExecutionError(`unexpected worker response: ${response.type}`, sql);
    }
    return { columns: response.columns, rows: response.rows };
  };

  const terminate = (): void => {
    worker.removeEventListener('message', onMessage);
    worker.removeEventListener('error', onError);
    worker.terminate();
    pending.clear();
    initPromise = undefined;
  };

  return { init, execute, terminate };
};
