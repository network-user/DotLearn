// Wave D of SEO/GEO: build-time generation of crawler/LLM-facing artifacts that
// sit next to the prerendered HTML (see prerender.mjs). Pure Node, no Vite:
// - dist/sitemap.xml            (all prerendered URLs + hreflang alternates)
// - dist/robots.txt             (crawl rules + AI-bot allowlist + sitemap ref)
// - dist/topics/<slug>.md       (ru markdown mirror of every topic)
// - dist/en/topics/<slug>.md    (en markdown mirror, topics with an en edition)
// - dist/llms.txt               (llmstxt.org index)
// - dist/llms-full.txt          (all ru theory concatenated)
// - dist/en/llms-full.txt       (theory concatenated for topics with an en edition)
//
// The markdown mirrors are produced by converting each theory MDX file with a
// standalone unified/remark pipeline (parse -> mdx -> gfm -> frontmatter ->
// concept-links -> heading-demote -> JSX-to-markdown -> stringify). This is a
// deliberately different path from prerender.mjs's React/@mdx-js/mdx renderer:
// here we want *markdown*, not HTML, so custom components are converted to
// plain markdown (code fences, lists, blockquotes) instead of React elements.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { performance } from 'node:perf_hooks';

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import remarkMdx from 'remark-mdx';
import remarkGfm from 'remark-gfm';
import remarkFrontmatter from 'remark-frontmatter';

import { remarkConceptLinks } from '../remark-concept-links.mjs';
import {
  WEB_ROOT,
  loadTopics,
  alternatesFor,
  theoryFilesFor,
  loadTheoryFile,
  conceptTitleFor,
  topicHasEn,
} from './seo-lib.mjs';

// --- small localized bits (kept local: prerender.mjs already owns its own
// copies of these dictionaries for the HTML surface, and it is not to be
// touched beyond the one import + call this wave adds) -----------------------

const DIFFICULTY_LABEL = {
  ru: { beginner: 'начальный', intermediate: 'средний', advanced: 'продвинутый' },
  en: { beginner: 'beginner', intermediate: 'intermediate', advanced: 'advanced' },
};
const DIFFICULTY_WORD = { ru: 'Сложность', en: 'Difficulty' };
const HOURS_UNIT = { ru: 'ч', en: 'h' };

const round1 = (value) => Math.round((Number(value) || 0) * 10) / 10;

const difficultyLabel = (lang, diff) =>
  (DIFFICULTY_LABEL[lang] && DIFFICULTY_LABEL[lang][diff]) || String(diff ?? '');

const metaLine = (lang, manifest) => {
  const parts = [
    `${DIFFICULTY_WORD[lang]}: ${difficultyLabel(lang, manifest.difficulty)}`,
    // "≈" rather than "~": a bare tilde is a GFM strikethrough delimiter, so
    // remark-stringify would escape it to "\~" when serializing plain text.
    `≈${round1(manifest.estimatedHours)} ${HOURS_UNIT[lang]}`,
  ];
  if (Array.isArray(manifest.tags) && manifest.tags.length) parts.push(manifest.tags.join(', '));
  return parts.join(' · ');
};

const topicTitle = (manifest, lang) =>
  lang === 'en' ? manifest.titleEn || manifest.title : manifest.title;

const topicDescription = (manifest, lang) => {
  if (!manifest.descriptions) return '';
  return lang === 'en'
    ? manifest.descriptions.en || manifest.descriptions.ru
    : manifest.descriptions.ru;
};

const HUB_ORDER = ['flashcards', 'glossary', 'interview', 'tracks', 'map', 'sandbox'];

// Same catalogue as prerender.mjs's renderHome: group already-alphabetical
// topics by category bucket, then flatten in catalogData.order.
const groupByCategory = (topics, catalogData) => {
  const byCategory = new Map();
  for (const topic of topics) {
    const category = catalogData.slugToCategory[topic.slug] || 'other';
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category).push(topic);
  }
  const ordered = [];
  for (const category of catalogData.order) {
    const list = byCategory.get(category);
    if (list) ordered.push(...list);
  }
  return ordered;
};

// --- chart/diagram components: crawlable placeholder only -------------------
// Exact copy of prerender.mjs's VIZ_NAMES (kept in sync manually; prerender.mjs
// is not to be edited beyond the single import + call this wave adds).
const VIZ_NAMES = new Set([
  'AccessScope',
  'AggregateViz',
  'CapTheoremFigure',
  'ClassFactory',
  'CompositionViz',
  'DocumentModelFigure',
  'GraphTraversalFigure',
  'GroupByViz',
  'HashTableViz',
  'HierarchyTreeFigure',
  'InheritanceTree',
  'JoinViz',
  'KeyValueStoreFigure',
  'MergeStepper',
  'NetworkModelFigure',
  'RefCountViz',
  'WideColumnFigure',
  'Sketch',
  'PipelineFigure',
  'RowFilterFigure',
  'SortLimitFigure',
  'NestedQueryFigure',
  'ObjectMemoryFigure',
  'MroFigure',
  'BarChart',
  'LineChart',
  'AreaChart',
  'DistributionChart',
  'TokenizerViz',
  'DecoratorWrap',
  'CallStackViz',
  'IoUViz',
  'AnchorGridViz',
  'NmsViz',
  'PrCurve',
  'AttentionHeatmap',
  'EmbeddingSpace',
  'SamplingBars',
  'ContextWindowViz',
  'AgentLoopDiagram',
  'McpDiagram',
  'PromptAnatomy',
  'FewShotViz',
  'ChainOfThoughtViz',
  'PerceptronViz',
  'ActivationPlot',
  'NetworkDiagram',
  'GradientDescentViz',
  'LossLandscape',
  'HashFunctionViz',
  'HashLoopDemo',
  'CollisionViz',
  'LoadFactorViz',
  'ConsistentHashRing',
]);

// Pure geometry primitives, only ever meaningful as Sketch's children. Sketch
// itself is in VIZ_NAMES (placeholder, children never visited), this set is a
// defensive fallback if one shows up unwrapped.
const SKETCH_PRIMITIVES = new Set(['SketchArrow', 'SketchBox', 'SketchHighlight', 'SketchLabel']);

// --- mdast node builders ------------------------------------------------------

const textNode = (value) => ({ type: 'text', value });

// Authors write backtick-delimited inline code inside plain string props
// (KeyTakeaways items, Checkpoint's q, ...); split those out into real
// `inlineCode` nodes instead of leaving literal backticks for remark-stringify
// to escape into "\`".
const parseInlineCode = (value) => {
  const segments = String(value ?? '')
    .split(/(`[^`]+`)/g)
    .filter((s) => s !== '');
  if (!segments.length) return [textNode('')];
  return segments.map((part) =>
    part.length >= 2 && part.startsWith('`') && part.endsWith('`')
      ? { type: 'inlineCode', value: part.slice(1, -1) }
      : textNode(part),
  );
};

const paragraph = (value) => ({ type: 'paragraph', children: parseInlineCode(value) });
const paragraphStrong = (value) => ({
  type: 'paragraph',
  children: [{ type: 'strong', children: parseInlineCode(value) }],
});
const paragraphEmphasis = (value) => ({
  type: 'paragraph',
  children: [{ type: 'emphasis', children: parseInlineCode(value) }],
});
const headingNode = (depth, value) => ({ type: 'heading', depth, children: [textNode(value)] });
const blockquoteOf = (children) => ({ type: 'blockquote', children });
const placeholder = (name) => paragraphEmphasis(`[Диаграмма: ${name}]`);

// Prefix `nodes` (block content) with a bold `label:` lead-in, merged into the
// first paragraph when there is one (falls back to its own bold paragraph
// when the content starts with something else, e.g. a list).
const labelBlock = (label, nodes) => {
  if (!label) return nodes;
  const [first, ...rest] = nodes;
  if (first && first.type === 'paragraph') {
    return [
      {
        type: 'paragraph',
        children: [
          { type: 'strong', children: [textNode(`${label}:`)] },
          textNode(' '),
          ...first.children,
        ],
      },
      ...rest,
    ];
  }
  return [paragraphStrong(label), ...nodes];
};

const PHRASING_TYPES = new Set([
  'text',
  'emphasis',
  'strong',
  'inlineCode',
  'break',
  'link',
  'linkReference',
  'image',
  'imageReference',
  'footnote',
  'footnoteReference',
  'delete',
]);

// Group a flat node list into valid "flow content" for blockquote/listItem
// children: consecutive phrasing nodes get wrapped in a paragraph, existing
// block nodes (paragraph, list, code, blockquote...) pass through untouched.
const wrapBlock = (nodes) => {
  const out = [];
  let buffer = [];
  const flush = () => {
    if (buffer.length) {
      out.push({ type: 'paragraph', children: buffer });
      buffer = [];
    }
  };
  for (const n of nodes) {
    if (!n) continue;
    if (PHRASING_TYPES.has(n.type)) buffer.push(n);
    else {
      flush();
      out.push(n);
    }
  }
  flush();
  return out;
};

const textContent = (nodes) => {
  let out = '';
  for (const n of nodes ?? []) {
    if (!n || typeof n !== 'object') continue;
    if (n.type === 'mdxFlowExpression' || n.type === 'mdxTextExpression') {
      // `<code>{`...`}</code>`: .value is the raw JS source of the expression
      // (including its own backticks) - unwrap the template literal instead
      // of leaking it as literal text, same rule as attribute extraction.
      const raw = typeof n.value === 'string' ? n.value.trim() : '';
      if (
        raw.length >= 2 &&
        raw.startsWith('`') &&
        raw.endsWith('`') &&
        !raw.slice(1, -1).includes('${')
      ) {
        out += unescapeTemplateLiteral(raw.slice(1, -1));
      }
      continue;
    }
    if (typeof n.value === 'string') out += n.value;
    else if (Array.isArray(n.children)) out += textContent(n.children);
  }
  return out;
};

const buildList = (liNodes, ordered) => {
  if (!liNodes.length) return null;
  return {
    type: 'list',
    ordered,
    spread: false,
    children: liNodes.map((li) => ({
      type: 'listItem',
      spread: false,
      children: wrapBlock(transformChildren(li.children ?? [])),
    })),
  };
};

// --- JSX attribute extraction -------------------------------------------------

const isJsxElement = (node) =>
  !!node && (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement');

const getAttr = (node, name) =>
  (node.attributes ?? []).find((a) => a && a.type === 'mdxJsxAttribute' && a.name === name);

// Raw source of an attribute value: a plain literal string, or the exact text
// between the JSX expression container's braces (mdast-util-mdx-jsx keeps this
// on `.value.value` regardless of whether acorn could parse it to an estree).
const attrRaw = (node, name) => {
  const attr = getAttr(node, name);
  if (!attr) return undefined;
  if (typeof attr.value === 'string') return { kind: 'literal', text: attr.value };
  if (attr.value && attr.value.type === 'mdxJsxAttributeValueExpression') {
    return { kind: 'expression', text: attr.value.value };
  }
  return undefined;
};

const attrLiteral = (node, name) => {
  const attr = getAttr(node, name);
  return attr && typeof attr.value === 'string' ? attr.value : undefined;
};

const unescapeTemplateLiteral = (inner) => inner.replace(/\\`/g, '`').replace(/\\\$\{/g, '${');

// The spec's rule for code/query/fixture: string literal as-is, template
// literal without ${...} unwrapped, anything else -> caller shows a placeholder.
const extractTemplateOrLiteral = (node, name) => {
  const raw = attrRaw(node, name);
  if (!raw) return undefined;
  if (raw.kind === 'literal') return raw.text;
  const t = raw.text.trim();
  if (t.length >= 2 && t.startsWith('`') && t.endsWith('`')) {
    const inner = t.slice(1, -1);
    if (!inner.includes('${')) return unescapeTemplateLiteral(inner);
  }
  return undefined;
};

const QUOTED_STRING_RE = /'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;

const unescapeQuoted = (s) =>
  s
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\(['"`\\])/g, '$1');

const extractQuotedStrings = (text) => {
  const out = [];
  let m;
  QUOTED_STRING_RE.lastIndex = 0;
  while ((m = QUOTED_STRING_RE.exec(text))) {
    out.push(unescapeQuoted(m[1] ?? m[2] ?? m[3] ?? ''));
  }
  return out;
};

// GitTerminal's `initial` prop is an object expression, not a template literal
// (`initial={{ files: {...}, commands: [...] }}`); pull the commands array out
// of the raw source with a targeted regex instead of a full JS parse.
const extractGitCommands = (node) => {
  const raw = attrRaw(node, 'initial');
  if (!raw || raw.kind !== 'expression') return undefined;
  const match = /commands\s*:\s*\[([\s\S]*?)\]/.exec(raw.text);
  if (!match) return undefined;
  const commands = extractQuotedStrings(match[1]);
  return commands.length ? commands.join('\n') : undefined;
};

// KeyTakeaways' real content is `items={[...]}`, an array of string literals.
const extractKeyTakeawaysItems = (node) => {
  const raw = attrRaw(node, 'items');
  if (!raw || raw.kind !== 'expression') return [];
  return extractQuotedStrings(raw.text);
};

// Best-effort plain-text recovery for attribute values that hold raw JSX/HTML
// (Compare's left/right can be a plain string OR `{<>...</>}` with p/code/b/ul
// nested inside). Not a parser: strips tags, keeps the text.
const stripInlineTags = (text) =>
  text
    .replace(/\{`([\s\S]*?)`\}/g, '$1')
    .replace(/<\/?>/g, ' ')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<(p|div|pre|ul|ol)[^>]*>/gi, '\n')
    .replace(/<\/(li|p|div|pre|ul|ol)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[a-zA-Z][^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

const extractProseAttr = (node, name) => {
  const raw = attrRaw(node, name);
  if (!raw) return undefined;
  return raw.kind === 'literal' ? raw.text.trim() : stripInlineTags(raw.text);
};

// Compare's left/right/verdict can be a plain string OR a JSX expression
// holding real markup (`{<ul><li>...</li></ul>}`, `{<span>...<b>...</b></span>}`).
// Rather than flattening that markup with regexes (loses list/code structure,
// and leftover "- " text reads as escaped "\-" once stringified), re-parse the
// raw attribute source as its own tiny MDX document through the very same
// pipeline used for theory bodies, so ul/li/b/code get the real AST treatment
// transformJsx already gives them. Returns block ("flow") nodes, or undefined
// if there is nothing here / it doesn't parse.
const proseNodesFromAttr = (node, name) => {
  const raw = attrRaw(node, name);
  if (!raw) return undefined;
  if (raw.kind === 'literal') {
    const trimmed = raw.text.trim();
    return trimmed ? [paragraph(trimmed)] : undefined;
  }
  const src = raw.text.trim();
  if (!src.startsWith('<')) return undefined; // not JSX-shaped (e.g. a bare variable) - nothing to mine
  try {
    const file = { value: `<>${src}</>` };
    const tree = markdownProcessor.parse(file);
    const transformed = markdownProcessor.runSync(tree, file);
    // Defense in depth at this specific injection point (arbitrary authored
    // JSX merging into the trusted document tree): guarantee block content
    // even if some tag handler above returns bare phrasing nodes.
    const nodes = wrapBlock(transformed.children ?? []);
    return nodes.length ? nodes : undefined;
  } catch {
    return undefined;
  }
};

const sanitizeHref = (href) => {
  if (typeof href !== 'string') return undefined;
  const value = href.trim();
  if (value === '') return undefined;
  if (/^(https?:\/\/|mailto:|#|\/|\.\/|\.\.\/)/i.test(value)) return value;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
  return undefined;
};

// --- heading demotion ---------------------------------------------------------
// Copied verbatim from prerender.mjs (prerender.mjs is not edited beyond its
// one allowed import + call): keep the same h1/h2 shift so ru/en HTML pages
// and md mirrors agree on heading depth.
const walkTree = (node, visit) => {
  if (!node || typeof node !== 'object') return;
  visit(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) walkTree(child, visit);
  }
};

const demoteHeadings = () => (tree) => {
  let hasDepth1 = false;
  walkTree(tree, (node) => {
    if (node.type === 'heading' && node.depth === 1) hasDepth1 = true;
  });
  const shift = hasDepth1 ? 2 : 1;
  walkTree(tree, (node) => {
    if (node.type === 'heading') node.depth = Math.min(6, (node.depth ?? 1) + shift);
  });
};

// --- MDX JSX -> markdown transform -------------------------------------------

function transformChildren(children) {
  const out = [];
  for (const child of children ?? []) {
    const replaced = transformNode(child);
    if (replaced === null || replaced === undefined) continue;
    if (Array.isArray(replaced)) out.push(...replaced.filter(Boolean));
    else out.push(replaced);
  }
  return out;
}

function transformNode(node) {
  if (!node || typeof node !== 'object') return node;
  if (node.type === 'yaml') return null; // stray frontmatter safety net
  if (node.type === 'mdxjsEsm') return null; // import/export statements
  if (node.type === 'mdxFlowExpression' || node.type === 'mdxTextExpression') return null;
  if (node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') {
    return transformJsx(node);
  }
  if (Array.isArray(node.children)) node.children = transformChildren(node.children);
  return node;
}

// Transform `node`'s children for splicing into a *block* position (root,
// blockquote, listItem, ...). When `node` itself sits at flow position
// (mdxJsxFlowElement) its children may be bare phrasing content (a lowercase
// `<p>`/`<div>` used as a one-off wrapper, e.g. inside Compare's left/right)
// - mdast forbids inline nodes as direct block-level siblings, and leaving
// one in confuses mdast-util-to-markdown's blank-line-between-siblings logic
// for the *entire rest of the document* (verified: one stray bare inlineCode
// node collapsed almost all paragraph spacing after it). wrapBlock groups
// runs of phrasing nodes into paragraphs, which is a no-op when the children
// are already block-level (Callout wrapping real paragraphs, etc). Inline
// (mdxJsxTextElement) positions are left as-is - the parent already expects
// phrasing content there.
const flowChildren = (node) => {
  const inner = transformChildren(node.children ?? []);
  return node.type === 'mdxJsxFlowElement' ? wrapBlock(inner) : inner;
};

function transformJsx(node) {
  const name = node.name;

  if (!name) return transformChildren(node.children ?? []); // fragment <>...</>

  // Code-bearing components: extract from attributes, or show a placeholder.
  if (name === 'PyDemo' || name === 'PyStepper') {
    const code = extractTemplateOrLiteral(node, 'code');
    return code === undefined ? placeholder(name) : { type: 'code', lang: 'python', value: code };
  }

  if (name === 'SideSql') {
    const query = extractTemplateOrLiteral(node, 'query');
    if (query === undefined) return placeholder(name);
    const out = [{ type: 'code', lang: 'sql', value: query }];
    const fixture = extractTemplateOrLiteral(node, 'fixture');
    if (fixture && fixture.trim()) out.push(paragraph(`Набор данных: ${fixture.trim()}`));
    return out;
  }

  if (name === 'GitTerminal') {
    const commands = extractGitCommands(node);
    return commands ? { type: 'code', lang: 'bash', value: commands } : placeholder(name);
  }

  // Charts/diagrams: no textual content worth mining, just note the figure.
  if (VIZ_NAMES.has(name)) return placeholder(name);
  if (SKETCH_PRIMITIVES.has(name)) return null;

  // Structural components whose real prose lives partly (or fully) in
  // attributes rather than children.
  if (name === 'KeyTakeaways') {
    const title = extractProseAttr(node, 'title');
    const items = extractKeyTakeawaysItems(node);
    const out = [];
    if (title) out.push(paragraphStrong(title));
    if (items.length) {
      out.push({
        type: 'list',
        ordered: false,
        spread: false,
        children: items.map((text) => ({
          type: 'listItem',
          spread: false,
          children: [paragraph(text)],
        })),
      });
    }
    out.push(...flowChildren(node));
    return out;
  }

  if (name === 'Compare') {
    const leftTitle = extractProseAttr(node, 'leftTitle');
    const rightTitle = extractProseAttr(node, 'rightTitle');
    const leftNodes = proseNodesFromAttr(node, 'left') ?? [];
    const rightNodes = proseNodesFromAttr(node, 'right') ?? [];
    const verdictNodes = proseNodesFromAttr(node, 'verdict') ?? [];
    return [
      ...labelBlock(leftTitle, leftNodes),
      ...labelBlock(rightTitle, rightNodes),
      ...verdictNodes,
      ...flowChildren(node),
    ];
  }

  if (name === 'Checkpoint') {
    // Matches prerender.mjs's own Checkpoint -> blockquote(q) treatment
    // (choices/answer/explain are interactive-only, not static prose there
    // either).
    const q = extractProseAttr(node, 'q');
    const inner = flowChildren(node);
    const content = q ? [paragraph(q), ...inner] : inner;
    return content.length ? blockquoteOf(wrapBlock(content)) : null;
  }

  if (name === 'PullQuote') {
    const inner = flowChildren(node);
    return inner.length ? blockquoteOf(wrapBlock(inner)) : null;
  }

  if (name === 'Figure') {
    const caption = extractProseAttr(node, 'caption');
    const out = flowChildren(node);
    if (caption) out.push(paragraphEmphasis(caption));
    return out;
  }

  if (name === 'Callout') {
    const title = extractProseAttr(node, 'title');
    const inner = flowChildren(node);
    return title ? [paragraphStrong(title), ...inner] : inner;
  }

  if (name === 'Detail') {
    const summary = extractProseAttr(node, 'summary');
    const inner = flowChildren(node);
    return summary ? [paragraphStrong(summary), ...inner] : inner;
  }

  if (name === 'SideViz') {
    const title = extractProseAttr(node, 'title');
    const inner = flowChildren(node);
    return title ? [paragraphStrong(title), ...inner] : inner;
  }

  if (name === 'Steps') {
    const items = (node.children ?? []).filter((c) => isJsxElement(c) && c.name === 'li');
    const list = buildList(items, true);
    return list ?? flowChildren(node);
  }

  // <pre><code>...</code></pre>: a real fenced code block, not inline code -
  // handled before the generic <code> rule below so it never even reaches it.
  if (name === 'pre') {
    const codeChild = (node.children ?? []).find((c) => isJsxElement(c) && c.name === 'code');
    const value = textContent((codeChild ?? node).children ?? []);
    return { type: 'code', lang: null, value };
  }

  // Raw HTML-ish tags used directly in prose (mostly inside Compare's
  // left/right when those are real children rather than attribute text, or
  // authored directly in a theory body).
  if (name === 'p') return { type: 'paragraph', children: transformChildren(node.children ?? []) };
  if (name === 'b' || name === 'strong')
    return { type: 'strong', children: transformChildren(node.children ?? []) };
  if (name === 'i' || name === 'em')
    return { type: 'emphasis', children: transformChildren(node.children ?? []) };
  if (name === 'code') return { type: 'inlineCode', value: textContent(node.children ?? []) };
  if (name === 'br') return { type: 'break' };
  if (name === 'a') {
    const href = sanitizeHref(attrLiteral(node, 'href'));
    return { type: 'link', url: href ?? '', children: transformChildren(node.children ?? []) };
  }
  if (name === 'img') {
    return {
      type: 'image',
      url: sanitizeHref(attrLiteral(node, 'src')) ?? '',
      alt: attrLiteral(node, 'alt') ?? '',
    };
  }
  if (name === 'ul' || name === 'ol') {
    const items = (node.children ?? []).filter((c) => isJsxElement(c) && c.name === 'li');
    return buildList(items, name === 'ol');
  }
  if (name === 'li') {
    const inner = transformChildren(node.children ?? []);
    return inner.length ? wrapBlock(inner) : null;
  }

  // Term, ConceptLink, MarginNote, span/u/sup/sub/div and any unknown
  // component: the prose is in the children, so keep those and drop the
  // wrapper (flowChildren guards against a bare phrasing result landing at
  // block position, see its comment above).
  return flowChildren(node);
}

// --- unified pipeline ----------------------------------------------------

const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkMdx)
  .use(remarkGfm)
  .use(remarkFrontmatter)
  .use(remarkConceptLinks)
  .use(demoteHeadings)
  .use(() => (tree) => {
    tree.children = transformChildren(tree.children ?? []);
  });

const stringifier = unified()
  .use(remarkGfm) // table/delete/etc. node types must be registered to stringify, not just parse
  .use(remarkStringify, {
    bullet: '-',
    fence: '`',
    fences: true,
    incrementListMarker: true,
    rule: '-',
  });

async function theoryBodyNodes(absPath, body) {
  const file = { value: body, path: absPath };
  const tree = markdownProcessor.parse(file);
  const transformed = await markdownProcessor.run(tree, file);
  return transformed.children ?? [];
}

async function buildTopicTree(topic, lang, siteUrl) {
  const m = topic.manifest;
  const title = topicTitle(m, lang);
  const description = topicDescription(m, lang);
  const url =
    lang === 'en' ? `${siteUrl}/en/topics/${topic.slug}` : `${siteUrl}/topics/${topic.slug}`;

  const children = [headingNode(1, title)];
  if (description) children.push(blockquoteOf([paragraph(description)]));
  children.push(paragraph(metaLine(lang, m)));
  // A real `link` node, not "Веб-версия: <url>" as plain text: besides being
  // clickable, it avoids remark-stringify escaping the "://" as literal text
  // (it would otherwise defensively escape the colon to keep this un-clickable
  // on re-parse, since GFM autolink-literal would otherwise turn a bare
  // https://... run of text into a link on its own).
  children.push({
    type: 'paragraph',
    children: [textNode('Веб-версия: '), { type: 'link', url, children: [textNode(url)] }],
  });

  for (const concept of m.concepts ?? []) {
    const files = theoryFilesFor(m, concept, lang);
    if (!files.length) continue;
    children.push(headingNode(2, conceptTitleFor(topic, concept, lang)));
    for (const rel of files) {
      const { body, abs } = loadTheoryFile(topic.dir, rel);
      children.push(...(await theoryBodyNodes(abs, body)));
    }
  }

  return { type: 'root', children };
}

async function buildTopicMarkdown(topic, lang, siteUrl) {
  const tree = await buildTopicTree(topic, lang, siteUrl);
  return stringifier.stringify(tree);
}

// --- sitemap.xml ---------------------------------------------------------

const xmlEscape = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const urlEntry = (loc, alternates) => {
  const lines = ['  <url>', `    <loc>${xmlEscape(loc)}</loc>`];
  for (const alt of alternates) {
    lines.push(
      `    <xhtml:link rel="alternate" hreflang="${xmlEscape(alt.hreflang)}" href="${xmlEscape(alt.href)}"/>`,
    );
  }
  lines.push('  </url>');
  return lines.join('\n');
};

function buildSitemap(siteUrl, topics) {
  const urls = [];
  const homeAlternates = alternatesFor(siteUrl, { ru: '/', en: '/en' });
  urls.push(urlEntry(`${siteUrl}/`, homeAlternates));
  urls.push(urlEntry(`${siteUrl}/en`, homeAlternates));

  for (const topic of topics) {
    const ruPath = `/topics/${topic.slug}`;
    const alternates = topicHasEn(topic)
      ? alternatesFor(siteUrl, { ru: ruPath, en: `/en/topics/${topic.slug}` })
      : [];
    urls.push(urlEntry(`${siteUrl}${ruPath}`, alternates));
  }

  for (const topic of topics) {
    if (!topicHasEn(topic)) continue;
    const ruPath = `/topics/${topic.slug}`;
    const enPath = `/en/topics/${topic.slug}`;
    urls.push(urlEntry(`${siteUrl}${enPath}`, alternatesFor(siteUrl, { ru: ruPath, en: enPath })));
  }

  const glossaryAlternates = alternatesFor(siteUrl, { ru: '/glossary', en: '/en/glossary' });
  for (const hub of HUB_ORDER) {
    urls.push(urlEntry(`${siteUrl}/${hub}`, hub === 'glossary' ? glossaryAlternates : []));
  }
  urls.push(urlEntry(`${siteUrl}/en/glossary`, glossaryAlternates));

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    `${urls.join('\n')}\n` +
    '</urlset>\n'
  );
}

// --- robots.txt ------------------------------------------------------------

const buildRobots = (siteUrl) => `User-agent: *
Disallow: /settings
Disallow: /progress
Disallow: /today
Disallow: /proposals
Disallow: /submit
Disallow: /search
Disallow: /flashcards/practice
Disallow: /interview/exam

User-agent: GPTBot
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: CCBot
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`;

// --- llms.txt ----------------------------------------------------------------

function buildLlmsTxt({ siteUrl, topics, catalogData }) {
  const enTopics = topics.filter(topicHasEn);
  const lines = [
    '# .learn',
    '',
    `> Бесплатная интерактивная платформа для изучения Python, SQL, Git и веб-разработки: ${topics.length} тем с теорией, песочницами и упражнениями в браузере, без регистрации. Основной язык русский, ${enTopics.length} тем переведены на английский.`,
    '',
    '## Темы',
  ];
  for (const topic of groupByCategory(topics, catalogData)) {
    lines.push(
      `- [${topicTitle(topic.manifest, 'ru')}](${siteUrl}/topics/${topic.slug}.md): ${topicDescription(topic.manifest, 'ru')}`,
    );
  }
  lines.push('', '## Topics (English)');
  for (const topic of enTopics) {
    lines.push(
      `- [${topicTitle(topic.manifest, 'en')}](${siteUrl}/en/topics/${topic.slug}.md): ${topicDescription(topic.manifest, 'en')}`,
    );
  }
  lines.push(
    '',
    '## Разделы',
    `- [Каталог тем](${siteUrl}/)`,
    `- [Флеш-карточки](${siteUrl}/flashcards)`,
    `- [Глоссарий](${siteUrl}/glossary.md): термины и определения с привязкой к темам`,
    `- [Вопросы с собеседований](${siteUrl}/interview)`,
    `- [Треки обучения](${siteUrl}/tracks)`,
    '',
    '## Optional',
    `- [llms-full.txt](${siteUrl}/llms-full.txt): вся русская теория одним файлом`,
  );
  if (enTopics.length) {
    lines.push(
      `- [en/llms-full.txt](${siteUrl}/en/llms-full.txt): all English-translated theory in one file`,
    );
  }
  lines.push(`- [sitemap.xml](${siteUrl}/sitemap.xml)`, '');
  return lines.join('\n');
}

// --- glossary markdown mirror ----------------------------------------------

const GLOSSARY_MD_STRINGS = {
  ru: {
    title: 'Глоссарий',
    intro: 'Термины и определения из курсов .learn.',
    general: 'Общие термины',
    web: 'Веб-версия',
    topic: 'Тема',
  },
  en: {
    title: 'Glossary',
    intro: 'Terms and definitions from the .learn courses.',
    general: 'General terms',
    web: 'Web version',
    topic: 'Topic',
  },
};

function buildGlossaryMarkdown({ lang, siteUrl, topics, glossary }) {
  const s = GLOSSARY_MD_STRINGS[lang];
  const pagePath = lang === 'en' ? '/en/glossary' : '/glossary';
  const topicBySlug = new Map(topics.map((topic) => [topic.slug, topic]));
  const collator = new Intl.Collator(lang);
  const byTopic = new Map();
  for (const entry of glossary) {
    const key = entry.topicSlug || '';
    if (!byTopic.has(key)) byTopic.set(key, []);
    byTopic.get(key).push(entry);
  }
  const groups = [...byTopic.entries()]
    .map(([slug, entries]) => {
      const topic = slug ? topicBySlug.get(slug) : undefined;
      return {
        slug,
        topic,
        title: topic ? topicTitle(topic.manifest, lang) : s.general,
        entries: entries.slice().sort((a, b) => collator.compare(a.term[lang], b.term[lang])),
      };
    })
    .sort((a, b) => {
      if (!a.slug) return 1;
      if (!b.slug) return -1;
      return collator.compare(a.title, b.title);
    });
  const lines = [`# ${s.title}`, '', `> ${s.intro}`, '', `${s.web}: ${siteUrl}${pagePath}`, ''];
  for (const group of groups) {
    lines.push(`## ${group.title}`, '');
    if (group.topic) {
      const path =
        lang === 'en' && topicHasEn(group.topic)
          ? `/en/topics/${group.slug}`
          : `/topics/${group.slug}`;
      lines.push(`${s.topic}: ${siteUrl}${path}`, '');
    }
    for (const entry of group.entries) {
      lines.push(`- **${entry.term[lang]}**: ${entry.def[lang]}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

// --- write everything ----------------------------------------------------

function writeTextFile(absPath, content) {
  mkdirSync(dirname(absPath), { recursive: true });
  writeFileSync(absPath, content, 'utf8');
  return Buffer.byteLength(content, 'utf8');
}

export async function emitSeoArtifacts({ distDir, siteUrl }) {
  const start = performance.now();
  const topics = loadTopics();
  const catalogData = JSON.parse(
    readFileSync(join(WEB_ROOT, 'src', 'lib', 'catalog-categories.data.json'), 'utf8'),
  );

  const sitemapXml = buildSitemap(siteUrl, topics);
  const sitemapSize = writeTextFile(join(distDir, 'sitemap.xml'), sitemapXml);
  const urlCount = (sitemapXml.match(/<url>/g) ?? []).length;

  const robotsSize = writeTextFile(join(distDir, 'robots.txt'), buildRobots(siteUrl));

  const glossary = JSON.parse(
    readFileSync(join(WEB_ROOT, 'src', 'lib', 'glossary.data.json'), 'utf8'),
  );
  writeTextFile(
    join(distDir, 'glossary.md'),
    buildGlossaryMarkdown({ lang: 'ru', siteUrl, topics, glossary }),
  );
  writeTextFile(
    join(distDir, 'en', 'glossary.md'),
    buildGlossaryMarkdown({ lang: 'en', siteUrl, topics, glossary }),
  );

  const ruMarkdowns = [];
  const enMarkdowns = [];
  let enCount = 0;
  for (const topic of topics) {
    const ruMd = await buildTopicMarkdown(topic, 'ru', siteUrl);
    writeTextFile(join(distDir, 'topics', `${topic.slug}.md`), ruMd);
    ruMarkdowns.push(ruMd);
    if (topicHasEn(topic)) {
      const enMd = await buildTopicMarkdown(topic, 'en', siteUrl);
      writeTextFile(join(distDir, 'en', 'topics', `${topic.slug}.md`), enMd);
      enMarkdowns.push(enMd);
      enCount += 1;
    }
  }

  const llmsTxt = buildLlmsTxt({ siteUrl, topics, catalogData });
  const llmsSize = writeTextFile(join(distDir, 'llms.txt'), llmsTxt);

  const llmsFull = `# .learn: полная теория (ru)\n\n${ruMarkdowns.map((m) => m.trim()).join('\n\n---\n\n')}\n`;
  const llmsFullSize = writeTextFile(join(distDir, 'llms-full.txt'), llmsFull);

  // EN counterpart: same shape as llms-full.txt, but only the topics that
  // actually have an en edition (symmetric with dist/en/topics/<slug>.md above).
  let llmsFullEnSize = 0;
  if (enMarkdowns.length) {
    const llmsFullEn = `# .learn: full theory (en)\n\n${enMarkdowns.map((m) => m.trim()).join('\n\n---\n\n')}\n`;
    llmsFullEnSize = writeTextFile(join(distDir, 'en', 'llms-full.txt'), llmsFullEn);
  }

  const durationMs = performance.now() - start;
  const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
  console.log(
    `[seo-artifacts] sitemap ${urlCount} urls (${kb(sitemapSize)}) · robots.txt (${kb(robotsSize)}) · ` +
      `${topics.length} ru + ${enCount} en markdown mirrors · llms.txt (${kb(llmsSize)}) · ` +
      `llms-full.txt (${kb(llmsFullSize)}) · en/llms-full.txt (${kb(llmsFullEnSize)}) · ` +
      `${(durationMs / 1000).toFixed(1)}s`,
  );

  return {
    sitemapUrlCount: urlCount,
    ruTopicCount: topics.length,
    enTopicCount: enCount,
    llmsTxtSize: llmsSize,
    llmsFullSize,
    llmsFullEnSize,
  };
}
