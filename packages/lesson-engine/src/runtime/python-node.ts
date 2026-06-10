import { loadPyodide, type PyodideInterface } from 'pyodide';

import { PythonExecutionError, type PythonExecution, type PythonRuntime } from './python';

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

const toPlain = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'object' && 'toJs' in value) {
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

export const createPythonNodeRuntime = (): PythonRuntime => {
  let pyodidePromise: Promise<PyodideInterface> | undefined;

  const ensure = (): Promise<PyodideInterface> => {
    if (!pyodidePromise) {
      pyodidePromise = loadPyodide();
    }
    return pyodidePromise;
  };

  return {
    evaluate: async (source: string, call: string): Promise<PythonExecution> => {
      let py: PyodideInterface;
      try {
        py = await ensure();
      } catch (error) {
        throw new PythonExecutionError(
          error instanceof Error ? error.message : String(error),
          error,
        );
      }

      const namespace = py.toPy({});
      const options = { globals: namespace };
      try {
        py.runPython(STDOUT_HARNESS, options);
        let result: unknown;
        let thrown: { type: string; message: string } | undefined;
        try {
          py.runPython(source, options);
          result = toPlain(py.runPython(call, options));
        } catch (error) {
          thrown = {
            type: error instanceof Error ? error.name : 'PythonError',
            message: error instanceof Error ? error.message : String(error),
          };
        }
        const stdout = py.runPython(STDOUT_TEARDOWN, options);
        return {
          result,
          stdout: typeof stdout === 'string' ? stdout : String(stdout ?? ''),
          ...(thrown !== undefined ? { thrown } : {}),
        };
      } finally {
        namespace.destroy();
      }
    },
  };
};
