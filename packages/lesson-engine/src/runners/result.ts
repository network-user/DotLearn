export type RunResult =
  | { ok: true; details?: unknown }
  | { ok: false; reason: string; details?: unknown };

export const pass = (details?: unknown): RunResult =>
  details === undefined ? { ok: true } : { ok: true, details };

export const fail = (reason: string, details?: unknown): RunResult =>
  details === undefined ? { ok: false, reason } : { ok: false, reason, details };
