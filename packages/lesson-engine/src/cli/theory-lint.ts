import { parse as parseYaml } from 'yaml';

export interface TheoryFrontmatter {
  conceptId?: string;
  title?: string;
  estimatedMinutes?: number;
}

export interface FrontmatterResult {
  frontmatter: TheoryFrontmatter;
  body: string;
  found: boolean;
}

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export const parseTheoryFrontmatter = (source: string): FrontmatterResult => {
  const match = FRONTMATTER_PATTERN.exec(source);
  if (!match) {
    return { frontmatter: {}, body: source, found: false };
  }
  const block = match[1] ?? '';
  let parsed: unknown;
  try {
    parsed = parseYaml(block);
  } catch {
    parsed = undefined;
  }
  const frontmatter: TheoryFrontmatter = {};
  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>;
    if (typeof record.conceptId === 'string') {
      frontmatter.conceptId = record.conceptId;
    }
    if (typeof record.title === 'string') {
      frontmatter.title = record.title;
    }
    if (typeof record.estimatedMinutes === 'number') {
      frontmatter.estimatedMinutes = record.estimatedMinutes;
    }
  }
  return { frontmatter, body: source.slice(match[0].length), found: true };
};

export const ESTIMATED_MINUTES_MIN = 5;
export const ESTIMATED_MINUTES_MAX = 240;

export interface FrontmatterIssue {
  reason: string;
}

export const lintTheoryFrontmatter = (
  result: FrontmatterResult,
  expectedConceptId: string,
): FrontmatterIssue[] => {
  const issues: FrontmatterIssue[] = [];
  if (!result.found) {
    issues.push({ reason: 'missing frontmatter block (--- ... ---)' });
    return issues;
  }
  const { conceptId, title, estimatedMinutes } = result.frontmatter;
  if (conceptId === undefined) {
    issues.push({ reason: 'frontmatter is missing conceptId' });
  } else if (conceptId !== expectedConceptId) {
    issues.push({
      reason: `frontmatter conceptId "${conceptId}" does not match concept "${expectedConceptId}"`,
    });
  }
  if (title === undefined || title.trim().length === 0) {
    issues.push({ reason: 'frontmatter is missing a non-empty title' });
  }
  if (estimatedMinutes === undefined) {
    issues.push({ reason: 'frontmatter is missing estimatedMinutes' });
  } else if (
    !Number.isInteger(estimatedMinutes) ||
    estimatedMinutes < ESTIMATED_MINUTES_MIN ||
    estimatedMinutes > ESTIMATED_MINUTES_MAX
  ) {
    issues.push({
      reason: `frontmatter estimatedMinutes (${estimatedMinutes}) must be an integer within ${ESTIMATED_MINUTES_MIN}-${ESTIMATED_MINUTES_MAX}`,
    });
  }
  return issues;
};

const FIGURE_PATTERN = /<(Figure|[A-Z][A-Za-z0-9]*(?:Figure|Chart|Diagram|Viz|Illustration|Plot))\b/;
const PY_SANDBOX_PATTERN = /<PyDemo\b/;

const openingTags = (body: string, component: string): string[] => {
  const tags: string[] = [];
  const matcher = new RegExp(`<${component}\\b`, 'g');
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(body)) !== null) {
    const start = match.index;
    const end = body.indexOf('>', start);
    tags.push(body.slice(start, end === -1 ? body.length : end + 1));
  }
  return tags;
};

const hasLiveSql = (body: string): boolean =>
  openingTags(body, 'SideSql').some((tag) => /\beditable\b/.test(tag) || /\blive\b/.test(tag));

export type ConceptRuntimeClass = 'sql' | 'python' | 'other';

export const classifyRuntimeForSandbox = (runtime: string): ConceptRuntimeClass => {
  if (runtime === 'sql.js') {
    return 'sql';
  }
  if (runtime === 'pyodide') {
    return 'python';
  }
  return 'other';
};

export const hasFigure = (body: string): boolean => FIGURE_PATTERN.test(body);

export const hasLiveSandbox = (body: string, runtimeClass: ConceptRuntimeClass): boolean => {
  if (runtimeClass === 'sql') {
    return hasLiveSql(body);
  }
  if (runtimeClass === 'python') {
    return PY_SANDBOX_PATTERN.test(body);
  }
  return true;
};
