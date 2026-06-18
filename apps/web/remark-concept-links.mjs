import { readFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { GLOSSARY_TERM_MATCHERS } from './src/lib/glossary-terms.mjs';

const WIKILINK_PATTERN = /\[\[([a-z][a-z0-9-]*[a-z0-9])\]\]/g;

const here = dirname(fileURLToPath(import.meta.url));
const topicsRoot = resolve(here, '../../topics');

const manifestCache = new Map();

const slugFromPath = (filePath) => {
  if (!filePath) return undefined;
  const normalized = filePath.split(sep).join('/');
  const match = /\/topics\/([a-z][a-z0-9-]*[a-z0-9])\/theory\//.exec(normalized);
  return match ? match[1] : undefined;
};

const languageFromPath = (filePath) => {
  if (!filePath) return 'ru';
  return /\.en\.mdx$/.test(filePath) ? 'en' : 'ru';
};

const conceptTitlesOf = (slug) => {
  if (manifestCache.has(slug)) return manifestCache.get(slug);
  let titles = new Map();
  try {
    const raw = readFileSync(join(topicsRoot, slug, 'manifest.json'), 'utf8');
    const manifest = JSON.parse(raw);
    if (Array.isArray(manifest.concepts)) {
      titles = new Map(
        manifest.concepts
          .filter((c) => typeof c?.id === 'string' && typeof c?.title === 'string')
          .map((c) => [c.id, c.title]),
      );
    }
  } catch {
    titles = new Map();
  }
  manifestCache.set(slug, titles);
  return titles;
};

const humanizeId = (id) =>
  id
    .split('-')
    .map((part) => (part.length > 0 ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');

const conceptLinkNode = (slug, conceptId, label) => ({
  type: 'mdxJsxTextElement',
  name: 'ConceptLink',
  attributes: [
    { type: 'mdxJsxAttribute', name: 'slug', value: slug },
    { type: 'mdxJsxAttribute', name: 'concept', value: conceptId },
  ],
  children: [{ type: 'text', value: label }],
});

const termNode = (id, label) => ({
  type: 'mdxJsxTextElement',
  name: 'Term',
  attributes: [{ type: 'mdxJsxAttribute', name: 'id', value: id }],
  children: [{ type: 'text', value: label }],
});

const splitTextByWikilinks = (value, slug, titles) => {
  WIKILINK_PATTERN.lastIndex = 0;
  if (!WIKILINK_PATTERN.test(value)) return undefined;
  WIKILINK_PATTERN.lastIndex = 0;
  const nodes = [];
  let lastIndex = 0;
  let match;
  while ((match = WIKILINK_PATTERN.exec(value)) !== null) {
    const [token, conceptId] = match;
    if (match.index > lastIndex) {
      nodes.push({ type: 'text', value: value.slice(lastIndex, match.index) });
    }
    const label = titles.get(conceptId) ?? humanizeId(conceptId);
    nodes.push(conceptLinkNode(slug, conceptId, label));
    lastIndex = match.index + token.length;
  }
  if (lastIndex < value.length) {
    nodes.push({ type: 'text', value: value.slice(lastIndex) });
  }
  return nodes;
};

const buildTermMatchers = (language) =>
  GLOSSARY_TERM_MATCHERS.flatMap((entry) =>
    entry.match[language].map((phrase) => ({
      id: entry.id,
      phrase,
      pattern: new RegExp(`(?<![\\p{L}\\p{N}_])(${escapeRegExp(phrase)})(?![\\p{L}\\p{N}_])`, 'iu'),
    })),
  ).sort((a, b) => b.phrase.length - a.phrase.length);

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const tokenizeTextByTerms = (value, matchers, usedTermIds) => {
  let remaining = value;
  const nodes = [];
  let changed = false;
  while (remaining.length > 0) {
    let best;
    for (const matcher of matchers) {
      if (usedTermIds.has(matcher.id)) continue;
      const found = matcher.pattern.exec(remaining);
      if (found && (!best || found.index < best.index)) {
        best = { matcher, index: found.index, text: found[0] };
        if (best.index === 0) break;
      }
    }
    if (!best) {
      nodes.push({ type: 'text', value: remaining });
      break;
    }
    changed = true;
    if (best.index > 0) nodes.push({ type: 'text', value: remaining.slice(0, best.index) });
    nodes.push(termNode(best.matcher.id, best.text));
    usedTermIds.add(best.matcher.id);
    remaining = remaining.slice(best.index + best.text.length);
  }
  return changed ? nodes : undefined;
};

const SKIP_TYPES = new Set([
  'code',
  'inlineCode',
  'heading',
  'mdxFlowExpression',
  'mdxTextExpression',
  'mdxjsEsm',
  'link',
  'linkReference',
]);

const collectExistingTermIds = (tree) => {
  const used = new Set();
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'mdxJsxTextElement' && node.name === 'Term') {
      const attr = (node.attributes ?? []).find((a) => a?.name === 'id');
      if (attr && typeof attr.value === 'string') used.add(attr.value);
    }
    if (Array.isArray(node.children)) node.children.forEach(walk);
  };
  walk(tree);
  return used;
};

export const remarkConceptLinks = () => (tree, file) => {
  const filePath = file?.path ?? file?.history?.[0];
  const slug = slugFromPath(filePath);
  if (!slug) return;
  const titles = conceptTitlesOf(slug);
  const language = languageFromPath(filePath);
  const termMatchers = buildTermMatchers(language);
  const manuallyTagged = collectExistingTermIds(tree);
  const usedTermIds = new Set(manuallyTagged);

  const replaceWikilinks = (node) => {
    if (!node || typeof node !== 'object' || SKIP_TYPES.has(node.type)) return;
    if (!Array.isArray(node.children)) return;
    const next = [];
    for (const child of node.children) {
      if (child.type === 'text' && typeof child.value === 'string') {
        const replacement = splitTextByWikilinks(child.value, slug, titles);
        if (replacement) {
          next.push(...replacement);
          continue;
        }
      }
      next.push(child);
    }
    node.children = next;
    node.children.forEach(replaceWikilinks);
  };

  const autolinkTerms = (node) => {
    if (!node || typeof node !== 'object' || SKIP_TYPES.has(node.type)) return;
    if (
      node.type === 'mdxJsxTextElement' &&
      (node.name === 'Term' || node.name === 'ConceptLink')
    ) {
      return;
    }
    if (!Array.isArray(node.children)) return;
    const next = [];
    for (const child of node.children) {
      if (child.type !== 'text' || typeof child.value !== 'string') {
        autolinkTerms(child);
        next.push(child);
        continue;
      }
      const replacement = tokenizeTextByTerms(child.value, termMatchers, usedTermIds);
      if (replacement) {
        next.push(...replacement);
      } else {
        next.push(child);
      }
    }
    node.children = next;
  };

  replaceWikilinks(tree);
  autolinkTerms(tree);
};

export default remarkConceptLinks;
