/**
 * Normalize a "code-ish" string so that quote style and insignificant spacing
 * stop mattering when two answers are compared, while newline structure and
 * letter case are always preserved.
 *
 * Rules, applied independently to each line (newlines are never removed,
 * collapsed, or introduced):
 *   1. Single quotes `'` are rewritten to double quotes `"`, so quote style no
 *      longer matters: `'a'` and `"a"` normalize the same.
 *   2. Spaces/tabs immediately before or after structural punctuation
 *      (`,` `:` `;` `[` `]` `{` `}` `(` `)`) are removed, so `[ 'a' , 'b' ]`
 *      and `['a','b']` normalize the same.
 *   3. Any remaining run of spaces/tabs collapses to a single space.
 *   4. Trailing whitespace on each line is trimmed. Leading indentation is kept
 *      (only collapsed by rule 3), so an indented line never equals a
 *      non-indented one and different structures stay distinct.
 *
 * Letter case, newlines, and the presence of leading indentation are preserved,
 * so `A` never equals `a` and `1\n2` never equals `1 2`.
 *
 * Deterministic and linear: every regex is a simple single-pass replacement
 * with no nested quantifiers, so there is no catastrophic backtracking.
 *
 * @example normalizeCodeish("['apple', 'banana']") === normalizeCodeish("['apple','banana']")
 * @example normalizeCodeish("'a'") === normalizeCodeish('"a"')
 * @example normalizeCodeish("{'x': 1}") === normalizeCodeish('{"x":1}')
 */
const SINGLE_QUOTE = /'/g;
// Character class members: , : ; [ ] { } ( )  (the leading `[` is literal inside a class).
const AROUND_STRUCTURAL_PUNCT = /[ \t]*([,:;[\]{}()])[ \t]*/g;
const WHITESPACE_RUN = /[ \t]+/g;
const TRAILING_WHITESPACE = /\s+$/;

const normalizeLine = (line: string): string =>
  line
    .replace(SINGLE_QUOTE, '"')
    .replace(AROUND_STRUCTURAL_PUNCT, '$1')
    .replace(WHITESPACE_RUN, ' ')
    .replace(TRAILING_WHITESPACE, '');

export const normalizeCodeish = (s: string): string => s.split('\n').map(normalizeLine).join('\n');

/**
 * Normalize predicted stdout for comparison.
 *
 * Learners type multi-print output in different ways: real newlines (`0\n1`),
 * spaces on one line (`0 1`), or a mix, and often omit the final newline that
 * YAML `|` / Python `print` leave behind. After CRLF unification and the
 * code-ish quote/spacing pass, every run of whitespace (spaces, tabs, newlines)
 * collapses to a single space and the ends are trimmed so those forms match.
 * Content tokens stay distinct: `a b` still differs from `ab`, and letter case
 * is preserved via {@link normalizeCodeish}.
 *
 * @example normalizeStdout("['_A__id']\n") === normalizeStdout("['_A__id']")
 * @example normalizeStdout("1\n2\n") === normalizeStdout("1 2")
 * @example normalizeStdout("0\n1") === normalizeStdout("0 1")
 * @example normalizeStdout("ab") !== normalizeStdout("a b")
 */
export const normalizeStdout = (s: string): string =>
  normalizeCodeish(s.replace(/\r\n/g, '\n').replace(/\r/g, '\n'))
    .replace(/\s+/g, ' ')
    .trim();
