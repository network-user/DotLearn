import { createPyodideRuntime, type PyodideRuntime } from '@dotlearn/sandbox';
import PyodideWorker from '@dotlearn/sandbox/python/worker?worker';

let cached: PyodideRuntime | undefined;

const selfHostedIndexUrl = (): string =>
  new URL(`${import.meta.env.BASE_URL}pyodide/`, window.location.origin).href;

export const getPythonRuntime = (): PyodideRuntime => {
  if (!cached) {
    cached = createPyodideRuntime({
      createWorker: () => new PyodideWorker(),
      indexUrl: selfHostedIndexUrl(),
    });
  }
  return cached;
};
