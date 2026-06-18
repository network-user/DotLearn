import type { FillInBlanksExercise } from '@dotlearn/contracts';

import { failCoded, pass, type RunResult } from './result';

// Defense-in-depth against ReDoS: never run a topic-supplied accept_regex against an
// unreasonably long answer. A legitimate fill-in-blank answer is short; this bounds the
// worst-case backtracking work even if a pathological pattern slipped through validation.
const MAX_BLANK_ANSWER_LENGTH = 2000;

interface BlankFailure {
  blank: string;
  got: string | undefined;
  reason: 'missing' | 'no-match';
}

export const runFillInBlanks = (
  exercise: FillInBlanksExercise,
  answers: Record<string, string>,
): RunResult => {
  const failures: BlankFailure[] = [];
  for (const [blankId, spec] of Object.entries(exercise.blanks)) {
    const got = answers[blankId];
    if (got === undefined) {
      failures.push({ blank: blankId, got: undefined, reason: 'missing' });
      continue;
    }
    let matched = false;
    if (spec.accept && spec.accept.length > 0) {
      matched = spec.accept.includes(got);
    }
    if (!matched && spec.accept_regex && got.length <= MAX_BLANK_ANSWER_LENGTH) {
      try {
        matched = new RegExp(spec.accept_regex).test(got);
      } catch {
        matched = false;
      }
    }
    if (!matched) {
      failures.push({ blank: blankId, got, reason: 'no-match' });
    }
  }
  if (failures.length === 0) {
    return pass();
  }
  return failCoded(
    'blanks-incorrect',
    `${failures.length} blank(s) incorrect`,
    { failed: failures.length },
    { failures },
  );
};
