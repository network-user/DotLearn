export interface SqlExecution {
  columns: string[];
  rows: Record<string, unknown>[];
}

export interface SqlRuntime {
  execute(sql: string, fixture?: string): Promise<SqlExecution>;
}

export class SqlExecutionError extends Error {
  constructor(
    message: string,
    public readonly sql: string,
    cause?: unknown,
  ) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'SqlExecutionError';
  }
}
