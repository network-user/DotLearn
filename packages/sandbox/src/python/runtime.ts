import {
  PythonExecutionError,
  type PythonExecution,
  type PythonRuntime,
} from '@dotlearn/lesson-engine';

import type { PyodideWorkerRequest, PyodideWorkerResponse } from './protocol';

export interface PyodideRuntimeOptions {
  worker: Worker;
  indexUrl?: string;
}

export interface PyodideRuntime extends PythonRuntime {
  init(): Promise<void>;
  terminate(): void;
}

interface PendingResolver {
  resolve(response: PyodideWorkerResponse): void;
  reject(error: Error): void;
}

let idCounter = 0;
const nextId = (): string => {
  idCounter += 1;
  return `py-${idCounter}`;
};

export const createPyodideRuntime = (options: PyodideRuntimeOptions): PyodideRuntime => {
  const { worker } = options;
  const pending = new Map<string, PendingResolver>();

  const onMessage = (event: MessageEvent<PyodideWorkerResponse>): void => {
    const response = event.data;
    const resolver = pending.get(response.id);
    if (!resolver) {
      return;
    }
    pending.delete(response.id);
    resolver.resolve(response);
  };

  const onError = (event: ErrorEvent): void => {
    const error = new Error(event.message || 'pyodide worker crashed');
    for (const resolver of pending.values()) {
      resolver.reject(error);
    }
    pending.clear();
  };

  worker.addEventListener('message', onMessage);
  worker.addEventListener('error', onError);

  const send = (request: PyodideWorkerRequest): Promise<PyodideWorkerResponse> =>
    new Promise<PyodideWorkerResponse>((resolve, reject) => {
      pending.set(request.id, { resolve, reject });
      worker.postMessage(request);
    });

  let initPromise: Promise<void> | undefined;

  const buildInitRequest = (): PyodideWorkerRequest =>
    options.indexUrl !== undefined
      ? { id: nextId(), type: 'init', indexUrl: options.indexUrl }
      : { id: nextId(), type: 'init' };

  const init = (): Promise<void> => {
    if (!initPromise) {
      initPromise = send(buildInitRequest()).then((response) => {
        if (response.type === 'error') {
          throw new PythonExecutionError(response.message);
        }
      });
    }
    return initPromise;
  };

  const evaluate = async (source: string, call: string): Promise<PythonExecution> => {
    await init();
    const response = await send({ id: nextId(), type: 'evaluate', source, call });
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
    worker.removeEventListener('message', onMessage);
    worker.removeEventListener('error', onError);
    worker.terminate();
    pending.clear();
    initPromise = undefined;
  };

  return { init, evaluate, terminate };
};
