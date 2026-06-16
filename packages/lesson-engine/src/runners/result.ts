export type RunFailureCode =
  | 'quiz-incorrect'
  | 'sql-error'
  | 'sql-runtime-error'
  | 'sql-rows-mismatch'
  | 'sql-scalar-mismatch'
  | 'predict-value-differs'
  | 'predict-stdout-differs'
  | 'predict-rows-mismatch'
  | 'cases-failed'
  | 'blanks-incorrect'
  | 'git-command-error'
  | 'git-goal-unmet'
  | 'invalid-answer';

export type RunFailureParams = Record<string, string | number>;

export type RunResult =
  | { ok: true; details?: unknown }
  | {
      ok: false;
      reason: string;
      code?: RunFailureCode;
      params?: RunFailureParams;
      details?: unknown;
    };

export const pass = (details?: unknown): RunResult =>
  details === undefined ? { ok: true } : { ok: true, details };

export const fail = (reason: string, details?: unknown): RunResult =>
  details === undefined ? { ok: false, reason } : { ok: false, reason, details };

export const failCoded = (
  code: RunFailureCode,
  reason: string,
  params?: RunFailureParams,
  details?: unknown,
): RunResult => ({
  ok: false,
  reason,
  code,
  ...(params !== undefined ? { params } : {}),
  ...(details !== undefined ? { details } : {}),
});
