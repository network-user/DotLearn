import {
  PythonExecutionError,
  type PythonExecution,
  type PythonRuntime,
} from '@dotlearn/lesson-engine';

import type { PyodideWorkerRequest, PyodideWorkerResponse } from './protocol';

export interface PyodideRuntimeOptions {
  createWorker: () => Worker;
  indexUrl?: string;
  timeoutMs?: number;
}

export interface PyodideRuntime extends PythonRuntime {
  init(): Promise<void>;
  terminate(): void;
}

interface PendingResolver {
  resolve(response: PyodideWorkerResponse): void;
  reject(error: Error): void;
  timer?: ReturnType<typeof setTimeout>;
}

const DEFAULT_TIMEOUT_MS = 10_000;

let idCounter = 0;
const nextId = (): string => {
  idCounter += 1;
  return `py-${idCounter}`;
};

export const createPyodideRuntime = (options: PyodideRuntimeOptions): PyodideRuntime => {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pending = new Map<string, PendingResolver>();

  let worker: Worker | undefined;
  let initPromise: Promise<void> | undefined;

  const onMessage = (event: MessageEvent<PyodideWorkerResponse>): void => {
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
    disposeWorker(new PythonExecutionError(event.message || 'pyodide worker crashed'));
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
    request: PyodideWorkerRequest,
    timeout: number | undefined,
  ): Promise<PyodideWorkerResponse> =>
    new Promise<PyodideWorkerResponse>((resolve, reject) => {
      const activeWorker = ensureWorker();
      const resolver: PendingResolver = { resolve, reject };
      if (timeout !== undefined) {
        resolver.timer = setTimeout(() => {
          pending.delete(request.id);
          disposeWorker(
            new PythonExecutionError(`python execution exceeded ${timeout}ms and was terminated`),
          );
        }, timeout);
      }
      pending.set(request.id, resolver);
      activeWorker.postMessage(request);
    });

  const buildInitRequest = (): PyodideWorkerRequest =>
    options.indexUrl !== undefined
      ? { id: nextId(), type: 'init', indexUrl: options.indexUrl }
      : { id: nextId(), type: 'init' };

  const init = (): Promise<void> => {
    if (!initPromise) {
      initPromise = send(buildInitRequest(), undefined).then((response) => {
        if (response.type === 'error') {
          throw new PythonExecutionError(response.message);
        }
      });
    }
    return initPromise;
  };

  const evaluate = async (source: string, call: string): Promise<PythonExecution> => {
    await init();
    const response = await send({ id: nextId(), type: 'evaluate', source, call }, timeoutMs);
    if (response.type === 'error') {
      throw new PythonExecutionError(response.message);
    }
    if (response.type !== 'result') {
      throw new PythonExecutionError(`unexpected worker response: ${response.type}`);
    }
    return {
      result: response.value,
      stdout: response.stdout,
      ...(response.thrown !== undefined ? { thrown: response.thrown } : {}),
    };
  };

  const terminate = (): void => {
    disposeWorker(new PythonExecutionError('python runtime terminated'), { warmReinit: false });
  };

  return { init, evaluate, terminate };
};
