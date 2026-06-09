export interface PythonExecution {
  result: unknown;
  stdout: string;
  thrown?: { type: string; message: string };
}

export interface PythonRuntime {
  evaluate(source: string, call: string): Promise<PythonExecution>;
}

export class PythonExecutionError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'PythonExecutionError';
  }
}
