/// <reference lib="webworker" />

const workerScope = self as unknown as DedicatedWorkerGlobalScope;

workerScope.addEventListener('message', (event: MessageEvent<unknown>) => {
  workerScope.postMessage({
    request: event.data,
    error: 'pyodide worker not implemented yet',
  });
});
