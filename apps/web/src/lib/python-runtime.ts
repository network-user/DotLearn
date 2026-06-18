import {
  createPyodideRuntime,
  type PyodideInitProgress,
  type PyodideRuntime,
} from '@dotlearn/sandbox';
import PyodideWorker from '@dotlearn/sandbox/python/worker?worker';

export type { PyodideInitProgress } from '@dotlearn/sandbox';

let cached: PyodideRuntime | undefined;
let latestProgress: PyodideInitProgress | undefined;
const progressListeners = new Set<(progress: PyodideInitProgress) => void>();

const selfHostedIndexUrl = (): string =>
  new URL(`${import.meta.env.BASE_URL}pyodide/`, window.location.origin).href;

export const getPythonRuntime = (): PyodideRuntime => {
  if (!cached) {
    cached = createPyodideRuntime({
      createWorker: () => new PyodideWorker(),
      indexUrl: selfHostedIndexUrl(),
      onInitProgress: (progress) => {
        latestProgress = progress;
        for (const listener of progressListeners) {
          listener(progress);
        }
      },
    });
  }
  return cached;
};

export const getLatestPythonInitProgress = (): PyodideInitProgress | undefined => latestProgress;

export const subscribePythonInitProgress = (
  listener: (progress: PyodideInitProgress) => void,
): (() => void) => {
  progressListeners.add(listener);
  return () => {
    progressListeners.delete(listener);
  };
};

let prewarmStarted = false;

export const prewarmPythonRuntime = (): void => {
  if (prewarmStarted) return;
  prewarmStarted = true;
  void getPythonRuntime()
    .init()
    .catch(() => {
      prewarmStarted = false;
    });
};

export const terminatePythonRuntime = (): void => {
  if (!cached) return;
  cached.terminate();
  cached = undefined;
  latestProgress = undefined;
  prewarmStarted = false;
  // Recreate lazily on the next getPythonRuntime()/init() (or the run button's prewarm-on-hover)
  // rather than eagerly, so a Stop after a runaway exercise cannot thrash terminate -> reinit.
};
