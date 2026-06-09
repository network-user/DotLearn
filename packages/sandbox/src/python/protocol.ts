export type PyodideWorkerRequest =
  | { id: string; type: 'init'; indexUrl?: string }
  | { id: string; type: 'evaluate'; source: string; call: string };

export type PyodideWorkerResponse =
  | { id: string; type: 'ready' }
  | {
      id: string;
      type: 'result';
      value: unknown;
      stdout: string;
      thrown?: { type: string; message: string };
    }
  | { id: string; type: 'error'; message: string };
