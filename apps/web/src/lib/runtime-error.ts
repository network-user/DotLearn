export type RuntimeErrorKind =
  | 'timeout'
  | 'crash'
  | 'stalled'
  | 'terminated'
  | 'unknown';

const PATTERNS: { kind: RuntimeErrorKind; test: RegExp }[] = [
  { kind: 'timeout', test: /exceeded\s+\d+ms and was terminated/i },
  { kind: 'stalled', test: /download stalled for \d+ms and was aborted/i },
  { kind: 'crash', test: /worker crashed/i },
  { kind: 'terminated', test: /runtime terminated/i },
];

export const classifyRuntimeError = (input: unknown): RuntimeErrorKind => {
  const message =
    input instanceof Error ? input.message : typeof input === 'string' ? input : String(input);
  for (const pattern of PATTERNS) {
    if (pattern.test.test(message)) return pattern.kind;
  }
  return 'unknown';
};
