export type SqlWorkerRequest =
  | { id: string; type: 'init'; wasmUrl?: string }
  | { id: string; type: 'execute'; sql: string; fixture?: string };

export type SqlWorkerResponse =
  | { id: string; type: 'ready' }
  | {
      id: string;
      type: 'result';
      columns: string[];
      rows: Record<string, unknown>[];
      truncated?: boolean;
    }
  | { id: string; type: 'error'; message: string };
