import { mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT_DIR = resolve(ROOT, 'interview');
const BASE = 'https://speedrunit.ru';
const LIST_URL = (page) => `${BASE}/questions/python/?page=${page}`;
const QUESTION_URL = (id) => `${BASE}/question/${id}/`;
const UA = 'Mozilla/5.0 (compatible; dotlearn-importer/1.0)';

const CATEGORY_SLUG = new Map([
  ['Python', 'python'],
  ['ООП', 'oop'],
  ['Асинхронность', 'async'],
  ['Базы данных', 'databases'],
  ['Алгоритмы', 'algorithms'],
  ['Архитектура', 'architecture'],
  ['Тестирование', 'testing'],
  ['Django', 'django'],
  ['Docker', 'docker'],
  ['Git', 'git'],
  ['HTTP / API', 'http-api'],
  ['Tools / DevOps / Linux', 'tools-devops-linux'],
  ['Разработка и процессы', 'development-processes'],
]);

const STAGE_LABEL = new Map([
  ['hr', 'HR'],
  ['tech', 'Tech'],
  ['system-design', 'System Design'],
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url, attempt = 0) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    if (new URL(res.url).host !== new URL(BASE).host) {
      throw new Error(`Refusing content from a cross-origin redirect: ${url} -> ${res.url}`);
    }
    return await res.text();
  } catch (err) {
    if (attempt < 3) {
      await sleep(500 * (attempt + 1));
      return fetchText(url, attempt + 1);
    }
    throw err;
  }
}

function decodeEntities(s) {
  return s
    .replace(/&#8203;/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&mdash;/g, '—')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8203;/g, '')
    .replace(/​/g, '');
}

function stripTags(s) {
  return s.replace(/<[^>]+>/g, '');
}

function inlineToMd(html) {
  let s = html;
  s = s.replace(
    /<code[^>]*>([\s\S]*?)<\/code>/g,
    (_, c) => '`' + decodeEntities(stripTags(c)).trim() + '`',
  );
  s = s.replace(
    /<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/g,
    (_, c) => '**' + inlineToMd(c).trim() + '**',
  );
  s = s.replace(
    /<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/g,
    (_, c) => '*' + inlineToMd(c).trim() + '*',
  );
  s = s.replace(
    /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g,
    (_, href, c) => `[${stripTags(c).trim()}](${href})`,
  );
  s = s.replace(/<br\s*\/?>/g, '\n');
  s = stripTags(s);
  s = decodeEntities(s);
  return s.replace(/[ \t]+/g, ' ').trim();
}

function listToMd(inner, ordered) {
  const items = [];
  const re = /<li[^>]*>([\s\S]*?)<\/li>/g;
  let m;
  let i = 1;
  while ((m = re.exec(inner))) {
    const marker = ordered ? `${i}. ` : '- ';
    items.push(marker + inlineToMd(m[1]));
    i += 1;
  }
  return items.join('\n');
}

function htmlToMarkdown(html) {
  const codeBlocks = [];
  let s = html;
  s = s.replace(
    /<pre[^>]*>\s*<code[^>]*class="language-([^"]*)"[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/g,
    (_, lang, code) => {
      const cleaned = decodeEntities(code).replace(/\n+$/, '');
      codeBlocks.push('```' + lang.trim() + '\n' + cleaned + '\n```');
      return `<p>@@CB${codeBlocks.length - 1}@@</p>`;
    },
  );
  s = s.replace(/<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/g, (_, code) => {
    const cleaned = decodeEntities(code).replace(/\n+$/, '');
    codeBlocks.push('```\n' + cleaned + '\n```');
    return `<p>@@CB${codeBlocks.length - 1}@@</p>`;
  });

  s = s.replace(/<p>\s*(?=<(?:h[1-6]|ul|ol|pre|blockquote))/g, '');
  s = s.replace(/<\/(h[1-6]|ul|ol|blockquote)>\s*<\/p>/g, '</$1>');

  const blocks = [];
  const blockRe = /<(h[1-6]|p|ul|ol|blockquote)[^>]*>([\s\S]*?)<\/\1>/g;
  let m;
  while ((m = blockRe.exec(s))) {
    const tag = m[1];
    const inner = m[2];
    if (/^h[1-6]$/.test(tag)) {
      const text = inlineToMd(inner);
      if (!text) continue;
      const isSection = /^[0-9]\u{fe0f}?\u{20e3}/u.test(text);
      blocks.push((isSection ? '## ' : '### ') + text);
    } else if (tag === 'p') {
      const raw = inner.trim();
      const cb = raw.match(/^@@CB(\d+)@@$/);
      if (cb) {
        blocks.push(`@@CB${cb[1]}@@`);
        continue;
      }
      const text = inlineToMd(inner);
      if (text) blocks.push(text);
    } else if (tag === 'ul' || tag === 'ol') {
      const md = listToMd(inner, tag === 'ol');
      if (md) blocks.push(md);
    } else if (tag === 'blockquote') {
      const text = inlineToMd(inner);
      if (text)
        blocks.push(
          text
            .split('\n')
            .map((l) => '> ' + l)
            .join('\n'),
        );
    }
  }

  let body = blocks.join('\n\n');
  body = body.replace(/@@CB(\d+)@@/g, (_, i) => codeBlocks[Number(i)]);
  body = body.replace(/\n{3,}/g, '\n\n').trim();
  return body;
}

function parseList(html) {
  const out = [];
  const itemRe =
    /<a href="\/question\/(\d+)\/[^"]*" class="question-link">\s*<li class="question-item ?" data-id="\d+">\s*<h2>([\s\S]*?)<\/h2>\s*<p class="question-topic\s*([a-z-]+)\s*">\s*([\s\S]*?)<\/p>/g;
  let m;
  while ((m = itemRe.exec(html))) {
    const id = Number(m[1]);
    const title = decodeEntities(stripTags(m[2])).trim();
    const stageSlug = m[3].trim();
    const topicLine = decodeEntities(stripTags(m[4])).trim();
    const categoryLabel = topicLine.split('|')[0].trim();
    out.push({ id, title, stageSlug, categoryLabel });
  }
  return out;
}

function extractAnswer(html) {
  const m = html.match(/<div class="markdown-content">([\s\S]*?)<\/div>/);
  if (!m) return '';
  return htmlToMarkdown(m[1]);
}

function yamlEscape(s) {
  return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function main() {
  console.log('Collecting question list...');
  const seen = new Map();
  for (let page = 1; page <= 10; page++) {
    const html = await fetchText(LIST_URL(page));
    const items = parseList(html);
    for (const it of items) if (!seen.has(it.id)) seen.set(it.id, it);
    console.log(`  page ${page}: +${items.length} (total ${seen.size})`);
  }
  const list = [...seen.values()];
  console.log(`Total unique questions: ${list.length}`);

  await rm(OUT_DIR, { recursive: true, force: true });

  const index = [];
  const failures = [];
  await mapLimit(list, 8, async (item) => {
    try {
      const html = await fetchText(QUESTION_URL(item.id));
      const body = extractAnswer(html);
      if (!body) throw new Error('empty body');
      const categorySlug = CATEGORY_SLUG.get(item.categoryLabel) ?? 'misc';
      const stageLabel = STAGE_LABEL.get(item.stageSlug) ?? item.stageSlug;
      const dir = resolve(OUT_DIR, categorySlug);
      await mkdir(dir, { recursive: true });
      const frontmatter = [
        '---',
        `id: ${item.id}`,
        `title: ${yamlEscape(item.title)}`,
        `category: ${categorySlug}`,
        `categoryLabel: ${yamlEscape(item.categoryLabel)}`,
        `stage: ${item.stageSlug}`,
        `stageLabel: ${yamlEscape(stageLabel)}`,
        'lang: ru',
        '---',
      ].join('\n');
      const mdx = `${frontmatter}\n\n# ${item.title}\n\n${body}\n`;
      await writeFile(resolve(dir, `${item.id}.ru.mdx`), mdx, 'utf-8');
      index.push({
        id: item.id,
        title: item.title,
        category: categorySlug,
        categoryLabel: item.categoryLabel,
        stage: item.stageSlug,
        stageLabel,
        path: `${categorySlug}/${item.id}.ru.mdx`,
      });
    } catch (err) {
      failures.push({ id: item.id, error: String(err) });
      console.warn(`  FAILED ${item.id}: ${err}`);
    }
  });

  index.sort((a, b) => a.category.localeCompare(b.category) || a.id - b.id);
  await writeFile(resolve(OUT_DIR, 'index.json'), JSON.stringify(index, null, 2) + '\n', 'utf-8');

  console.log(`\nDone. Wrote ${index.length} questions, ${failures.length} failures.`);
  if (failures.length) console.log(JSON.stringify(failures, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
