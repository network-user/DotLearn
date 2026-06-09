import { PythonExecutionError, type PythonExecution, type PythonRuntime } from '@dotlearn/lesson-engine';

export interface PyodideRuntimeOptions {
  worker?: Worker;
  indexUrl?: string;
}

export const createPyodideRuntime = (_options: PyodideRuntimeOptions = {}): PythonRuntime => ({
  evaluate: async (_source: string, _call: string): Promise<PythonExecution> => {
    throw new PythonExecutionError('pyodide runtime not implemented yet');
  },
});
