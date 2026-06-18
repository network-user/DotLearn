export type PyodideInitPhase = 'download' | 'boot' | 'packages';

export interface PyodideInitProgress {
  phase: PyodideInitPhase;
  loadedBytes: number;
  totalBytes: number;
  message?: string;
}

export type PyodideWorkerRequest =
  | { id: string; type: 'init'; indexUrl?: string }
  | { id: string; type: 'evaluate'; source: string; call: string };

export type PyodideWorkerResponse =
  | { id: string; type: 'ready' }
  | { id: string; type: 'init-progress'; progress: PyodideInitProgress }
  | {
      id: string;
      type: 'result';
      value: unknown;
      stdout: string;
      thrown?: { type: string; message: string };
    }
  | { id: string; type: 'error'; message: string };
