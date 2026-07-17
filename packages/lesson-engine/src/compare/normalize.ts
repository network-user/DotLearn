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
 * so `A` never equals `a` and `1\n2` never equals `1 2` under this helper alone.
 * Stdout comparison uses {@link stdoutMatches}, which may still accept a
 * space-joined single-line form when the expected side has no blank lines.
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
 * Line-oriented stdout normalization: unify CRLF, apply code-ish rules per line,
 * drop only trailing empty lines (YAML `|` / print final newline). Mid-string
 * blank lines stay so empty-line pedagogy is not lost.
 *
 * @example normalizeStdout("a\n") === "a"
 * @example normalizeStdout("a\n\nb\n") === "a\n\nb"
 */
export const normalizeStdout = (s: string): string => normalizeStdoutLines(s).join('\n');

export const normalizeStdoutLines = (s: string): string[] => {
  const lines = normalizeCodeish(s.replace(/\r\n/g, '\n').replace(/\r/g, '\n')).split('\n');
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop();
  }
  return lines;
};

const collapseHorizontal = (s: string): string => s.replace(/[ \t]+/g, ' ').trim();

/**
 * Whether two predicted stdout answers match.
 *
 * 1. Line-for-line after {@link normalizeStdoutLines}.
 * 2. Else, when expected has no blank lines, a space-joined form of the lines
 *    also matches (learners often type multi-print output as `0 1` instead of
 *    `0\n1`). Blank lines in expected block that fallback so `a\n\nb` stays
 *    distinct from `a\nb`.
 */
export const stdoutMatches = (actual: string, expected: string): boolean => {
  const actualLines = normalizeStdoutLines(actual);
  const expectedLines = normalizeStdoutLines(expected);
  if (
    actualLines.length === expectedLines.length &&
    actualLines.every((line, index) => line === expectedLines[index])
  ) {
    return true;
  }
  if (expectedLines.some((line) => line === '')) {
    return false;
  }
  const flatExpected = collapseHorizontal(expectedLines.join(' '));
  const flatActual = collapseHorizontal(actualLines.join(' '));
  return flatExpected.length > 0 && flatExpected === flatActual;
};
