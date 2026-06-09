import { createPyodideRuntime, type PyodideRuntime } from '@dotlearn/sandbox';
import PyodideWorker from '@dotlearn/sandbox/python/worker?worker';

let cached: PyodideRuntime | undefined;

export const getPythonRuntime = (): PyodideRuntime => {
  if (!cached) {
    cached = createPyodideRuntime({ worker: new PyodideWorker() });
  }
  return cached;
};
