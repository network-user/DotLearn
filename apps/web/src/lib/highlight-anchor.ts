export interface HighlightMarkInput {
  id: string;
  text: string;
  className: string;
  prefix?: string | undefined;
  suffix?: string | undefined;
}

export const HIGHLIGHT_MARK_ATTRIBUTE = 'data-highlight-id';
export const HIGHLIGHT_CONTEXT_RADIUS = 40;

const MAX_MATCH_CANDIDATES = 50;

interface TextSegment {
  node: Text;
  start: number;
  end: number;
}

interface MatchSpan {
  index: number;
  length: number;
}

export const normalizeHighlightWhitespace = (value: string): string =>
  value.replace(/\s+/g, ' ').trim();

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const patternFor = (text: string): RegExp | null => {
  const normalized = normalizeHighlightWhitespace(text);
  if (normalized.length < 3) return null;
  const source = normalized.split(' ').map(escapeRegExp).join('\\s+');
  try {
    return new RegExp(source, 'g');
  } catch {
    return null;
  }
};

const collectSegments = (root: Element): { segments: TextSegment[]; text: string } => {
  const segments: TextSegment[] = [];
  let text = '';
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  while (current) {
    const value = current.nodeValue ?? '';
    if (value.length > 0) {
      segments.push({
        node: current as Text,
        start: text.length,
        end: text.length + value.length,
      });
      text += value;
    }
    current = walker.nextNode();
  }
  return { segments, text };
};

const sharedSuffixLength = (left: string, right: string): number => {
  let count = 0;
  while (
    count < left.length &&
    count < right.length &&
    left[left.length - 1 - count] === right[right.length - 1 - count]
  ) {
    count += 1;
  }
  return count;
};

const sharedPrefixLength = (left: string, right: string): number => {
  let count = 0;
  while (count < left.length && count < right.length && left[count] === right[count]) {
    count += 1;
  }
  return count;
};

const contextScore = (
  haystack: string,
  candidate: MatchSpan,
  prefix: string | undefined,
  suffix: string | undefined,
): number => {
  let score = 0;
  if (prefix) {
    const wanted = normalizeHighlightWhitespace(prefix);
    const before = normalizeHighlightWhitespace(
      haystack.slice(Math.max(0, candidate.index - HIGHLIGHT_CONTEXT_RADIUS * 3), candidate.index),
    );
    score += sharedSuffixLength(before, wanted);
  }
  if (suffix) {
    const wanted = normalizeHighlightWhitespace(suffix);
    const after = normalizeHighlightWhitespace(
      haystack.slice(
        candidate.index + candidate.length,
        candidate.index + candidate.length + HIGHLIGHT_CONTEXT_RADIUS * 3,
      ),
    );
    score += sharedPrefixLength(after, wanted);
  }
  return score;
};

const findBestMatch = (
  haystack: string,
  text: string,
  prefix: string | undefined,
  suffix: string | undefined,
): MatchSpan | null => {
  const pattern = patternFor(text);
  if (!pattern) return null;
  const candidates: MatchSpan[] = [];
  let match = pattern.exec(haystack);
  while (match && candidates.length < MAX_MATCH_CANDIDATES) {
    candidates.push({ index: match.index, length: match[0].length });
    pattern.lastIndex = match.index + Math.max(1, match[0].length);
    match = pattern.exec(haystack);
  }
  if (candidates.length === 0) return null;
  const first = candidates[0] as MatchSpan;
  if (candidates.length === 1 || (!prefix && !suffix)) return first;
  let best = first;
  let bestScore = contextScore(haystack, first, prefix, suffix);
  for (const candidate of candidates.slice(1)) {
    const score = contextScore(haystack, candidate, prefix, suffix);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
};

const wrapSpan = (
  segments: TextSegment[],
  span: MatchSpan,
  id: string,
  className: string,
): void => {
  const matchStart = span.index;
  const matchEnd = span.index + span.length;
  for (const segment of segments) {
    if (segment.end <= matchStart || segment.start >= matchEnd) continue;
    const node = segment.node;
    const localStart = Math.max(0, matchStart - segment.start);
    const localEnd = Math.min(node.length, matchEnd - segment.start);
    if (localEnd <= localStart) continue;
    const piece = (node.nodeValue ?? '').slice(localStart, localEnd);
    if (piece.trim().length === 0) continue;
    if (!node.parentNode) continue;
    let target = node;
    if (localStart > 0) target = target.splitText(localStart);
    if (localEnd - localStart < target.length) target.splitText(localEnd - localStart);
    const mark = document.createElement('mark');
    mark.setAttribute(HIGHLIGHT_MARK_ATTRIBUTE, id);
    mark.className = className;
    target.parentNode?.replaceChild(mark, target);
    mark.appendChild(target);
  }
};

const escapeAttributeValue = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

const marksFor = (root: Element, id: string): HTMLElement[] =>
  Array.from(
    root.querySelectorAll<HTMLElement>(
      `mark[${HIGHLIGHT_MARK_ATTRIBUTE}="${escapeAttributeValue(id)}"]`,
    ),
  );

const unwrapMark = (mark: HTMLElement): void => {
  const parent = mark.parentNode;
  if (!parent) return;
  while (mark.firstChild) {
    parent.insertBefore(mark.firstChild, mark);
  }
  parent.removeChild(mark);
  parent.normalize();
};

export const pruneHighlightMarks = (root: Element, keepIds: ReadonlySet<string>): void => {
  const marks = Array.from(root.querySelectorAll<HTMLElement>(`mark[${HIGHLIGHT_MARK_ATTRIBUTE}]`));
  for (const mark of marks) {
    const id = mark.getAttribute(HIGHLIGHT_MARK_ATTRIBUTE);
    if (id && keepIds.has(id)) continue;
    unwrapMark(mark);
  }
};

export const applyHighlightMarks = (
  root: Element,
  highlights: readonly HighlightMarkInput[],
): number => {
  let applied = 0;
  for (const highlight of highlights) {
    const existing = marksFor(root, highlight.id);
    if (existing.length > 0) {
      for (const mark of existing) {
        if (mark.className !== highlight.className) mark.className = highlight.className;
      }
      applied += 1;
      continue;
    }
    const { segments, text } = collectSegments(root);
    const span = findBestMatch(text, highlight.text, highlight.prefix, highlight.suffix);
    if (!span) continue;
    wrapSpan(segments, span, highlight.id, highlight.className);
    applied += 1;
  }
  return applied;
};

export const captureSelectionContext = (
  root: Element,
  range: Range,
): { prefix: string; suffix: string } => {
  const before = document.createRange();
  before.selectNodeContents(root);
  before.setEnd(range.startContainer, range.startOffset);
  const after = document.createRange();
  after.selectNodeContents(root);
  after.setStart(range.endContainer, range.endOffset);
  return {
    prefix: normalizeHighlightWhitespace(before.toString()).slice(-HIGHLIGHT_CONTEXT_RADIUS),
    suffix: normalizeHighlightWhitespace(after.toString()).slice(0, HIGHLIGHT_CONTEXT_RADIUS),
  };
};
