// Build-time static prerender for SEO/GEO. Runs after `vite build`: reads the
// hashed dist/index.html shell and emits crawler-visible static HTML mirrors of
// every topic (ru + en), the two home pages, the head-only hubs and 404. No
// hydration — the SPA still boots from the same shell and overwrites #root.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { performance } from 'node:perf_hooks';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { compile, run } from '@mdx-js/mdx';
import * as jsxRuntime from 'react/jsx-runtime';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkMdxFrontmatter from 'remark-mdx-frontmatter';

import { remarkConceptLinks } from '../remark-concept-links.mjs';
import {
  WEB_ROOT,
  DIST_ROOT,
  loadTopics,
  resolveSiteUrl,
  alternatesFor,
  hoursToISO8601,
  minutesToISO8601,
  escapeHtml,
  escapeAttr,
  theoryFilesFor,
  loadTheoryFile,
  conceptTitleFor,
  topicHasEn,
  loadLocale,
} from './seo-lib.mjs';
import { emitSeoArtifacts } from './seo-artifacts.mjs';

const SITE = resolveSiteUrl();
const topics = loadTopics();
const locales = { ru: loadLocale('ru'), en: loadLocale('en') };
const catalogData = JSON.parse(
  readFileSync(join(WEB_ROOT, 'src', 'lib', 'catalog-categories.data.json'), 'utf8'),
);
const glossary = JSON.parse(
  readFileSync(join(WEB_ROOT, 'src', 'lib', 'glossary.data.json'), 'utf8'),
);

const LABELS = {
  ru: {
    contents: 'Содержание',
    sources: 'Источники',
    difficulty: 'Сложность',
    home: 'Главная',
    hours: 'ч',
  },
  en: {
    contents: 'Contents',
    sources: 'Sources',
    difficulty: 'Difficulty',
    home: 'Home',
    hours: 'h',
  },
};
const DIFFICULTY = {
  ru: { beginner: 'начальный', intermediate: 'средний', advanced: 'продвинутый' },
  en: { beginner: 'beginner', intermediate: 'intermediate', advanced: 'advanced' },
};
const FALLBACK_HOME_TITLE = {
  ru: 'Интерактивные курсы Python, SQL, Git и веб-разработки',
  en: 'Interactive courses in Python, SQL, Git and web development',
};
const fallbackHomeDescription = (lang, count) =>
  lang === 'en'
    ? `A local-first learning workbench: ${count} topics on Python, SQL, Git, the web, databases and architecture. Theory, live code and exercises right in the browser.`
    : `Локальная мастерская обучения: ${count} тем по Python, SQL, Git, вебу, базам данных и архитектуре. Теория, живой код и упражнения прямо в браузере.`;

const HUBS = {
  flashcards: { title: 'Карточки', description: 'Интервальное повторение по всем темам .learn.' },
  interview: {
    title: 'Подготовка к собеседованию',
    description: 'Вопросы для технических интервью по Python, SQL и вебу.',
  },
  tracks: {
    title: 'Треки обучения',
    description: 'Программы из нескольких тем .learn, собранные по порядку.',
  },
  map: { title: 'Карта знаний', description: 'Связи между темами и концептами .learn.' },
  sandbox: {
    title: 'Песочница',
    description: 'Запуск Python и SQL прямо в браузере, без установки.',
  },
};

const round1 = (value) => Math.round((Number(value) || 0) * 10) / 10;
const difficultyLabel = (lang, diff) =>
  (DIFFICULTY[lang] && DIFFICULTY[lang][diff]) || String(diff ?? '');
const hoursLabel = (lang, hours) => `~${round1(hours)} ${LABELS[lang].hours}`;

const sanitizeHref = (href) => {
  if (typeof href !== 'string') return undefined;
  const value = href.trim();
  if (value === '') return undefined;
  if (/^(https?:\/\/|mailto:|#|\/|\.\/|\.\.\/)/i.test(value)) return value;
  // relative reference without a URL scheme (e.g. "foo/bar")
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) return value;
  return undefined;
};

// --- MDX → static HTML -------------------------------------------------------

const h = createElement;
const kids = (props) => (props && 'children' in props ? props.children : null);

const walkTree = (node, visit) => {
  if (!node || typeof node !== 'object') return;
  visit(node);
  if (Array.isArray(node.children)) {
    for (const child of node.children) walkTree(child, visit);
  }
};

// +shift each heading so the page has exactly one h1 (the topic title) and h2 is
// reserved for concept-section headings: bodies containing a native h1 shift by 2
// (h1→h3), bodies starting at h2 shift by 1 (h2→h3). Cap at h6.
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

const vizFigure = (name) => (props) =>
  h('figure', null, h('figcaption', null, props?.title ?? props?.caption ?? props?.label ?? name));

// Chart / diagram / illustration components: rendered as a captioned <figure>.
const VIZ_NAMES = [
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
];

const baseComponents = {
  a: (p) => h('a', { href: sanitizeHref(p?.href) }, kids(p)),
  img: (p) => h('img', { src: sanitizeHref(p?.src), alt: p?.alt ?? '' }),
  Callout: (p) =>
    h('aside', null, p?.title ? h('p', null, h('strong', null, p.title)) : null, kids(p)),
  Detail: (p) =>
    h(
      'details',
      null,
      p?.summary != null ? h('summary', null, p.summary) : null,
      h('div', null, kids(p)),
    ),
  Steps: (p) => h('div', null, kids(p)),
  KeyTakeaways: (p) =>
    h(
      'aside',
      null,
      p?.title ? h('p', null, h('strong', null, p.title)) : null,
      h(
        'ul',
        null,
        (Array.isArray(p?.items) ? p.items : []).map((item, i) => h('li', { key: i }, item)),
      ),
    ),
  Checkpoint: (p) => h('blockquote', null, p?.q ? h('p', null, p.q) : null, kids(p)),
  Term: (p) => h('span', null, kids(p)),
  ConceptLink: (p) => h('a', { href: `#${String(p?.concept ?? '')}` }, kids(p)),
  SideViz: (p) =>
    h('aside', null, p?.title ? h('p', null, h('strong', null, p.title)) : null, kids(p)),
  SideSql: (p) => {
    const query = typeof p?.query === 'string' ? p.query.trim() : '';
    const caption = p?.fixture ? h('figcaption', null, `SQL · fixture: ${p.fixture}`) : null;
    if (!query) return h('figure', null, caption ?? h('figcaption', null, 'SQL'));
    return h(
      'figure',
      null,
      h('pre', null, h('code', { className: 'language-sql' }, query)),
      caption,
    );
  },
  PyDemo: (p) =>
    h(
      'pre',
      null,
      h('code', { className: 'language-python' }, typeof p?.code === 'string' ? p.code.trim() : ''),
    ),
  PyStepper: (p) =>
    h(
      'pre',
      null,
      h('code', { className: 'language-python' }, typeof p?.code === 'string' ? p.code.trim() : ''),
    ),
  GitTerminal: (p) => {
    const commands = Array.isArray(p?.initial?.commands) ? p.initial.commands : [];
    return h('pre', null, h('code', { className: 'language-bash' }, commands.join('\n')));
  },
  Compare: (p) =>
    h(
      'div',
      null,
      h(
        'div',
        null,
        p?.leftTitle ? h('p', null, h('strong', null, p.leftTitle)) : null,
        p?.left ?? null,
      ),
      h(
        'div',
        null,
        p?.rightTitle ? h('p', null, h('strong', null, p.rightTitle)) : null,
        p?.right ?? null,
      ),
      p?.verdict ? h('div', null, p.verdict) : null,
    ),
  Figure: (p) => h('figure', null, kids(p), p?.caption ? h('figcaption', null, p.caption) : null),
  PullQuote: (p) => h('blockquote', null, kids(p)),
  MarginNote: (p) => h('aside', null, kids(p)),
  Ref: (p) => h('sup', null, kids(p)),
  Footnotes: (p) => h('div', null, kids(p)),
  SketchArrow: () => null,
  SketchBox: () => null,
  SketchHighlight: () => null,
  SketchLabel: () => null,
};
for (const name of VIZ_NAMES) {
  if (!(name in baseComponents)) baseComponents[name] = vizFigure(name);
}

const fallbackStub = (p) => h('div', null, kids(p));

const compileOptions = {
  outputFormat: 'function-body',
  providerImportSource: false,
  remarkPlugins: [
    remarkFrontmatter,
    remarkGfm,
    remarkMdxFrontmatter,
    remarkConceptLinks,
    demoteHeadings,
  ],
};

let healedComponents = 0;
let healedGlobals = 0;

// Some viz labels embed browser-global identifiers as JSX expressions (e.g.
// `SELECT '{name}'` referencing `window.name`). Their host components are dropped
// from the static output, but JSX children are evaluated eagerly, so the bare
// identifier must resolve. Define such globals to '' on demand (build-time only).
const defineMissingGlobal = (identifier) => {
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(identifier)) return false;
  if (typeof globalThis[identifier] !== 'undefined') return false;
  try {
    globalThis[identifier] = '';
    return true;
  } catch {
    return false;
  }
};

const renderTheoryBody = async (absPath, body) => {
  const compiled = await compile({ path: absPath, value: body }, compileOptions);
  const mod = await run(compiled, { ...jsxRuntime, baseUrl: import.meta.url });
  const components = { ...baseComponents };
  for (const match of body.matchAll(/<([A-Z][A-Za-z0-9]*)/g)) {
    if (!(match[1] in components)) components[match[1]] = fallbackStub;
  }
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      return renderToStaticMarkup(createElement(mod.default, { components }));
    } catch (error) {
      const message = String(error?.message ?? '');
      const missingComponent = /component `([^`]+)`/.exec(message);
      if (missingComponent && !(missingComponent[1] in components)) {
        components[missingComponent[1]] = fallbackStub;
        healedComponents += 1;
        continue;
      }
      const missingGlobal = /(\w+) is not defined/.exec(message);
      if (missingGlobal && defineMissingGlobal(missingGlobal[1])) {
        healedGlobals += 1;
        continue;
      }
      throw new Error(`prerender: failed to render ${absPath}: ${message}`);
    }
  }
  throw new Error(`prerender: unresolved references in ${absPath}`);
};

const renderConceptSection = async (topic, concept, lang) => {
  const files = theoryFilesFor(topic.manifest, concept, lang);
  if (files.length === 0) return null;
  const title = conceptTitleFor(topic, concept, lang);
  let inner = '';
  for (const rel of files) {
    const { body, abs } = loadTheoryFile(topic.dir, rel);
    inner += await renderTheoryBody(abs, body);
  }
  return `<section id="${escapeAttr(concept.id)}">\n<h2>${escapeHtml(title)}</h2>\n${inner}\n</section>`;
};

// --- page assembly -----------------------------------------------------------

const jsonLdScript = (obj) =>
  `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

const metaTag = (attrs) =>
  `<meta ${Object.entries(attrs)
    .map(([key, value]) => `${key}="${escapeAttr(value)}"`)
    .join(' ')}>`;

const buildHead = ({
  lang,
  canonical,
  alternates,
  description,
  ogType,
  ogTitle,
  ogImage,
  jsonLd,
}) => {
  const lines = [`<link rel="canonical" href="${escapeAttr(canonical)}">`];
  for (const alt of alternates) {
    lines.push(
      `<link rel="alternate" hreflang="${escapeAttr(alt.hreflang)}" href="${escapeAttr(alt.href)}">`,
    );
  }
  if (description) lines.push(metaTag({ name: 'description', content: description }));
  lines.push(metaTag({ property: 'og:title', content: ogTitle }));
  if (description) lines.push(metaTag({ property: 'og:description', content: description }));
  lines.push(metaTag({ property: 'og:type', content: ogType }));
  lines.push(metaTag({ property: 'og:url', content: canonical }));
  lines.push(metaTag({ property: 'og:image', content: ogImage }));
  lines.push(metaTag({ property: 'og:locale', content: lang === 'en' ? 'en_US' : 'ru_RU' }));
  lines.push(metaTag({ property: 'og:site_name', content: '.learn' }));
  lines.push(metaTag({ name: 'twitter:card', content: 'summary_large_image' }));
  lines.push(metaTag({ name: 'twitter:title', content: ogTitle }));
  if (description) lines.push(metaTag({ name: 'twitter:description', content: description }));
  lines.push(metaTag({ name: 'twitter:image', content: ogImage }));
  for (const obj of jsonLd ?? []) lines.push(jsonLdScript(obj));
  return `\n${lines.map((line) => `    ${line}`).join('\n')}\n  `;
};

const shellPath = join(DIST_ROOT, 'index.html');
const shell = readFileSync(shellPath, 'utf8');
if (!shell.includes('<div id="root"></div>')) {
  throw new Error('prerender: dist/index.html shell has no empty <div id="root"></div>');
}
if (!shell.includes('</head>')) {
  throw new Error('prerender: dist/index.html shell has no </head>');
}

const applyShell = ({ lang, title, head, body, robots }) => {
  let out = shell;
  out = out.replace(/<html lang="[^"]*"/, `<html lang="${escapeAttr(lang)}"`);
  out = out.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`);
  const headBlock = (robots ? `\n    ${metaTag({ name: 'robots', content: robots })}` : '') + head;
  out = out.replace('</head>', `${headBlock}</head>`);
  out = out.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
  return out;
};

const conceptsWithLang = (topic, lang) =>
  (topic.manifest.concepts ?? []).filter((c) => theoryFilesFor(topic.manifest, c, lang).length > 0);

const courseJsonLd = (topic, lang, pageUrl) => {
  const m = topic.manifest;
  const name = lang === 'en' ? m.titleEn || m.title : m.title;
  const description = m.descriptions
    ? lang === 'en'
      ? m.descriptions.en || m.descriptions.ru
      : m.descriptions.ru
    : undefined;
  const concepts = conceptsWithLang(topic, lang);
  const timeRequired = hoursToISO8601(m.estimatedHours);
  const provider = { '@type': 'Organization', name: '.learn', url: SITE };
  if (process.env.VITE_GITHUB_URL) provider.sameAs = [process.env.VITE_GITHUB_URL];
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name,
    ...(description ? { description } : {}),
    url: pageUrl,
    courseCode: m.slug,
    inLanguage: lang,
    ...(m.difficulty ? { educationalLevel: m.difficulty } : {}),
    timeRequired,
    ...(Array.isArray(m.tags) && m.tags.length ? { keywords: m.tags.join(', ') } : {}),
    teaches: concepts.map((c) => conceptTitleFor(topic, c, lang)),
    ...(Array.isArray(m.sources) && m.sources.length
      ? { citation: m.sources.map((s) => ({ '@type': 'CreativeWork', name: s.title, url: s.url })) }
      : {}),
    hasPart: concepts.map((c) => ({
      '@type': 'LearningResource',
      name: conceptTitleFor(topic, c, lang),
      timeRequired: minutesToISO8601(c.estimatedMinutes ?? 0),
      url: `${pageUrl}#${c.id}`,
    })),
    provider,
    isAccessibleForFree: true,
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'online',
      courseWorkload: timeRequired,
    },
  };
};

const breadcrumbJsonLd = (lang, homeUrl, pageUrl, title) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: LABELS[lang].home, item: homeUrl },
    { '@type': 'ListItem', position: 2, name: title, item: pageUrl },
  ],
});

const websiteJsonLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: '.learn',
  url: SITE,
  potentialAction: {
    '@type': 'SearchAction',
    target: `${SITE}/search?q={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
});

const renderTopicBody = async (topic, lang) => {
  const m = topic.manifest;
  const L = LABELS[lang];
  const title = lang === 'en' ? m.titleEn || m.title : m.title;
  const description = m.descriptions
    ? lang === 'en'
      ? m.descriptions.en || m.descriptions.ru
      : m.descriptions.ru
    : '';
  const tocItems = [];
  const sections = [];
  for (const concept of m.concepts ?? []) {
    const section = await renderConceptSection(topic, concept, lang);
    if (!section) continue;
    const conceptTitle = conceptTitleFor(topic, concept, lang);
    tocItems.push(`<li><a href="#${escapeAttr(concept.id)}">${escapeHtml(conceptTitle)}</a></li>`);
    sections.push(section);
  }
  const metaLine = [
    `${escapeHtml(L.difficulty)}: ${escapeHtml(difficultyLabel(lang, m.difficulty))}`,
    escapeHtml(hoursLabel(lang, m.estimatedHours)),
    Array.isArray(m.tags) && m.tags.length ? escapeHtml(m.tags.join(', ')) : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const parts = [`<h1>${escapeHtml(title)}</h1>`];
  if (description) parts.push(`<p>${escapeHtml(description)}</p>`);
  parts.push(`<p>${metaLine}</p>`);
  if (tocItems.length) {
    parts.push(
      `<nav aria-label="${escapeAttr(L.contents)}"><p><strong>${escapeHtml(L.contents)}</strong></p><ul>${tocItems.join('')}</ul></nav>`,
    );
  }
  parts.push(sections.join('\n'));
  if (Array.isArray(m.sources) && m.sources.length) {
    const items = m.sources
      .map(
        (s) =>
          `<li><a href="${escapeAttr(sanitizeHref(s.url) ?? '')}">${escapeHtml(s.title || s.url)}</a></li>`,
      )
      .join('');
    parts.push(`<aside><p><strong>${escapeHtml(L.sources)}</strong></p><ul>${items}</ul></aside>`);
  }
  return { html: parts.join('\n'), title, description, sectionCount: sections.length };
};

const renderHome = (lang) => {
  const loc = locales[lang] ?? {};
  const seo = loc.seo ?? {};
  const homeTitle = seo.homeTitle || FALLBACK_HOME_TITLE[lang];
  const homeDescription = seo.homeDescription || fallbackHomeDescription(lang, topics.length);
  const categoryLabels = (loc.home && loc.home.categories) || {};

  const byCategory = new Map();
  for (const topic of topics) {
    const category = catalogData.slugToCategory[topic.slug] || 'other';
    if (!byCategory.has(category)) byCategory.set(category, []);
    byCategory.get(category).push(topic);
  }

  const parts = [`<h1>${escapeHtml(homeTitle)}</h1>`, `<p>${escapeHtml(homeDescription)}</p>`];
  for (const category of catalogData.order) {
    const list = byCategory.get(category);
    if (!list || !list.length) continue;
    const label = categoryLabels[category] || category;
    const items = list
      .map((topic) => {
        const m = topic.manifest;
        const hasEn = topicHasEn(topic);
        const title = lang === 'en' ? m.titleEn || m.title : m.title;
        const description = m.descriptions
          ? lang === 'en'
            ? m.descriptions.en || m.descriptions.ru
            : m.descriptions.ru
          : '';
        const href =
          lang === 'en'
            ? hasEn
              ? `/en/topics/${topic.slug}`
              : `/topics/${topic.slug}`
            : `/topics/${topic.slug}`;
        const meta = `${escapeHtml(difficultyLabel(lang, m.difficulty))} · ${escapeHtml(hoursLabel(lang, m.estimatedHours))}`;
        return `<li><a href="${escapeAttr(href)}">${escapeHtml(title)}</a> <span>(${meta})</span>${description ? `<div>${escapeHtml(description)}</div>` : ''}</li>`;
      })
      .join('');
    parts.push(`<section><h2>${escapeHtml(label)}</h2><ul>${items}</ul></section>`);
  }
  return { html: parts.join('\n'), title: homeTitle, description: homeDescription };
};

// --- write everything --------------------------------------------------------

const pages = [];
const writePage = (relPath, html) => {
  const abs = join(DIST_ROOT, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  const buffer = Buffer.from(html, 'utf8');
  writeFileSync(abs, buffer);
  pages.push({ path: relPath, size: buffer.length });
  if (buffer.length > 600 * 1024) {
    console.warn(`[prerender] WARN large page ${relPath}: ${(buffer.length / 1024).toFixed(0)} KB`);
  }
};

const start = performance.now();

for (const topic of topics) {
  const canonicalPath = `/topics/${topic.slug}`;
  const pageUrl = SITE + canonicalPath;
  const homeUrl = `${SITE}/`;
  const hasEn = topicHasEn(topic);
  const alternates = hasEn
    ? alternatesFor(SITE, { ru: canonicalPath, en: `/en/topics/${topic.slug}` })
    : [];

  const ru = await renderTopicBody(topic, 'ru');
  writePage(
    `topics/${topic.slug}/index.html`,
    applyShell({
      lang: 'ru',
      title: `${ru.title} · .learn`,
      head: buildHead({
        lang: 'ru',
        canonical: pageUrl,
        alternates,
        description: ru.description,
        ogType: 'article',
        ogTitle: ru.title,
        ogImage: `${SITE}/og/${topic.slug}.png`,
        jsonLd: [
          courseJsonLd(topic, 'ru', pageUrl),
          breadcrumbJsonLd('ru', homeUrl, pageUrl, ru.title),
        ],
      }),
      body: ru.html,
    }),
  );

  if (hasEn) {
    const enUrl = `${SITE}/en/topics/${topic.slug}`;
    const enHome = `${SITE}/en`;
    const en = await renderTopicBody(topic, 'en');
    writePage(
      `en/topics/${topic.slug}/index.html`,
      applyShell({
        lang: 'en',
        title: `${en.title} · .learn`,
        head: buildHead({
          lang: 'en',
          canonical: enUrl,
          alternates: alternatesFor(SITE, { ru: canonicalPath, en: `/en/topics/${topic.slug}` }),
          description: en.description,
          ogType: 'article',
          ogTitle: en.title,
          ogImage: `${SITE}/og/${topic.slug}.png`,
          jsonLd: [
            courseJsonLd(topic, 'en', enUrl),
            breadcrumbJsonLd('en', enHome, enUrl, en.title),
          ],
        }),
        body: en.html,
      }),
    );
  }
}

// Home pages (ru overwrites the shell we just read from memory).
{
  const homeAlternates = alternatesFor(SITE, { ru: '/', en: '/en' });
  const ru = renderHome('ru');
  writePage(
    'index.html',
    applyShell({
      lang: 'ru',
      title: `.learn · ${ru.title}`,
      head: buildHead({
        lang: 'ru',
        canonical: `${SITE}/`,
        alternates: homeAlternates,
        description: ru.description,
        ogType: 'website',
        ogTitle: ru.title,
        ogImage: `${SITE}/og/default.png`,
        jsonLd: [websiteJsonLd()],
      }),
      body: ru.html,
    }),
  );

  const en = renderHome('en');
  writePage(
    'en/index.html',
    applyShell({
      lang: 'en',
      title: `.learn · ${en.title}`,
      head: buildHead({
        lang: 'en',
        canonical: `${SITE}/en`,
        alternates: homeAlternates,
        description: en.description,
        ogType: 'website',
        ogTitle: en.title,
        ogImage: `${SITE}/og/default.png`,
        jsonLd: [websiteJsonLd()],
      }),
      body: en.html,
    }),
  );
}

// Glossary (ru + en): full term list with DefinedTermSet JSON-LD.
{
  const GLOSSARY_FALLBACK = {
    ru: {
      title: 'Глоссарий',
      general: 'Общие термины',
      open: 'Открыть тему',
      description: 'Термины и определения из курсов .learn.',
    },
    en: {
      title: 'Glossary',
      general: 'General terms',
      open: 'Open the topic',
      description: 'A programming glossary with definitions linked to the course topics.',
    },
  };
  const topicBySlug = new Map(topics.map((topic) => [topic.slug, topic]));

  const renderGlossaryBody = (lang) => {
    const loc = (locales[lang] && locales[lang].glossary) || {};
    const fallback = GLOSSARY_FALLBACK[lang];
    const title = loc.title || fallback.title;
    const subtitle = loc.subtitle || '';
    const description =
      (locales[lang] && locales[lang].seo && locales[lang].seo.glossaryDescription) ||
      fallback.description;
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
        const groupTitle = topic
          ? lang === 'en'
            ? topic.manifest.titleEn || topic.manifest.title
            : topic.manifest.title
          : loc.generalGroup || fallback.general;
        return {
          slug,
          topic,
          title: groupTitle,
          entries: entries.slice().sort((a, b) => collator.compare(a.term[lang], b.term[lang])),
        };
      })
      .sort((a, b) => {
        if (!a.slug) return 1;
        if (!b.slug) return -1;
        return collator.compare(a.title, b.title);
      });
    const sections = groups
      .map((group) => {
        const href = group.topic
          ? lang === 'en' && topicHasEn(group.topic)
            ? `/en/topics/${group.slug}`
            : `/topics/${group.slug}`
          : undefined;
        const link = href
          ? ` <a href="${escapeAttr(href)}">${escapeHtml(loc.openTopic || fallback.open)}</a>`
          : '';
        const terms = group.entries
          .map(
            (entry) =>
              `<div id="${escapeAttr(entry.id)}"><dt>${escapeHtml(entry.term[lang])}</dt><dd>${escapeHtml(entry.def[lang])}</dd></div>`,
          )
          .join('');
        return `<section><h2>${escapeHtml(group.title)}</h2>${link}<dl>${terms}</dl></section>`;
      })
      .join('\n');
    const html = `<h1>${escapeHtml(title)}</h1>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}\n${sections}`;
    return { html, title, description };
  };

  const glossaryJsonLd = (lang, pageUrl, name) => ({
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    '@id': pageUrl,
    url: pageUrl,
    name,
    inLanguage: lang,
    hasDefinedTerm: glossary.map((entry) => ({
      '@type': 'DefinedTerm',
      name: entry.term[lang],
      description: entry.def[lang],
      url: `${pageUrl}#${entry.id}`,
      inDefinedTermSet: pageUrl,
    })),
  });

  const glossaryAlternates = alternatesFor(SITE, { ru: '/glossary', en: '/en/glossary' });
  for (const lang of ['ru', 'en']) {
    const canonical = lang === 'en' ? `${SITE}/en/glossary` : `${SITE}/glossary`;
    const page = renderGlossaryBody(lang);
    writePage(
      lang === 'en' ? 'en/glossary/index.html' : 'glossary/index.html',
      applyShell({
        lang,
        title: `${page.title} · .learn`,
        head: buildHead({
          lang,
          canonical,
          alternates: glossaryAlternates,
          description: page.description,
          ogType: 'website',
          ogTitle: page.title,
          ogImage: `${SITE}/og/default.png`,
          jsonLd: [glossaryJsonLd(lang, canonical, page.title)],
        }),
        body: page.html,
      }),
    );
  }
}

// Head-only hubs (empty #root, like the source shell).
for (const [hub, meta] of Object.entries(HUBS)) {
  const canonical = `${SITE}/${hub}`;
  writePage(
    `${hub}/index.html`,
    applyShell({
      lang: 'ru',
      title: `${meta.title} · .learn`,
      head: buildHead({
        lang: 'ru',
        canonical,
        alternates: [],
        description: meta.description,
        ogType: 'website',
        ogTitle: meta.title,
        ogImage: `${SITE}/og/default.png`,
      }),
      body: '',
    }),
  );
}

// 404 (noindex).
writePage(
  '404.html',
  applyShell({
    lang: 'ru',
    title: 'Страница не найдена · .learn',
    robots: 'noindex',
    head: buildHead({
      lang: 'ru',
      canonical: `${SITE}/404`,
      alternates: [],
      description: '',
      ogType: 'website',
      ogTitle: 'Страница не найдена · .learn',
      ogImage: `${SITE}/og/default.png`,
    }),
    body: '<h1>404</h1><p>Страница не найдена. <a href="/">Вернуться на главную</a>.</p>',
  }),
);

// --- summary -----------------------------------------------------------------

const durationMs = performance.now() - start;
const sizes = pages.map((p) => p.size).sort((a, b) => a - b);
const total = sizes.reduce((sum, size) => sum + size, 0);
const median = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 0;
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
console.log(
  `[prerender] ${pages.length} pages in ${(durationMs / 1000).toFixed(1)}s · ` +
    `min ${kb(sizes[0] ?? 0)} · median ${kb(median)} · max ${kb(sizes[sizes.length - 1] ?? 0)} · total ${kb(total)}` +
    (healedComponents ? ` · healed ${healedComponents} component refs` : '') +
    (healedGlobals ? ` · healed ${healedGlobals} global refs` : ''),
);

// --- SEO artifacts: sitemap.xml, robots.txt, llms(.full).txt, markdown mirrors
await emitSeoArtifacts({ distDir: DIST_ROOT, siteUrl: SITE });
