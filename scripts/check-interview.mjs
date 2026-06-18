import { readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT_DIR = resolve(ROOT, 'interview');

const errors = [];
const warnings = [];

const normalizeTitle = (title) =>
  title
    .toLowerCase()
    .replace(/[«»"'`?.,:;!()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

async function isDir(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function main() {
  const index = JSON.parse(await readFile(resolve(OUT_DIR, 'index.json'), 'utf-8'));
  const exIndex = JSON.parse(await readFile(resolve(OUT_DIR, 'exercises-index.json'), 'utf-8'));

  // 1. index entries point at real files; ids unique
  const ids = new Set();
  for (const q of index) {
    if (ids.has(q.id)) errors.push(`duplicate question id ${q.id}`);
    ids.add(q.id);
    if (!existsSync(resolve(OUT_DIR, q.path))) errors.push(`index path missing: ${q.path}`);
    if (
      q.exerciseCount > 0 &&
      !existsSync(resolve(OUT_DIR, q.path.replace(/\.ru\.mdx$/, '.exercises.json')))
    ) {
      errors.push(`exercise file missing for q${q.id}`);
    }
  }

  // 2. every .ru.mdx is represented in the index
  const indexedPaths = new Set(index.map((q) => q.path));
  let fileCount = 0;
  for (const cat of await readdir(OUT_DIR)) {
    const dir = resolve(OUT_DIR, cat);
    if (!(await isDir(dir))) continue;
    for (const file of await readdir(dir)) {
      if (!file.endsWith('.ru.mdx')) continue;
      fileCount += 1;
      if (!indexedPaths.has(`${cat}/${file}`)) errors.push(`file not in index: ${cat}/${file}`);
    }
  }
  if (fileCount !== index.length) {
    errors.push(`file count ${fileCount} != index length ${index.length}`);
  }

  const flashcardsPath = resolve(OUT_DIR, 'flashcards-index.json');
  if (!existsSync(flashcardsPath)) {
    errors.push('flashcards-index.json missing — run pnpm build:interview-flashcards');
  } else {
    const flashcards = JSON.parse(await readFile(flashcardsPath, 'utf-8'));
    if (!Array.isArray(flashcards?.ru?.cards)) {
      errors.push('flashcards-index.json: ru.cards must be an array');
    }
    if (!Array.isArray(flashcards?.ru?.missing)) {
      errors.push('flashcards-index.json: ru.missing must be an array');
    }
    if (flashcards?.ru?.missing?.length > 0) {
      warnings.push(
        `${flashcards.ru.missing.length} interview article(s) missing a flashcard answer section`,
      );
    }
  }

  for (const locale of ['ru', 'en']) {
    const localePath = resolve(OUT_DIR, `flashcards-index.${locale}.json`);
    if (!existsSync(localePath)) {
      errors.push(`flashcards-index.${locale}.json missing — run pnpm build:interview-flashcards`);
      continue;
    }
    const localeData = JSON.parse(await readFile(localePath, 'utf-8'));
    if (!Array.isArray(localeData?.cards)) {
      errors.push(`flashcards-index.${locale}.json: cards must be an array`);
    }
    if (!Array.isArray(localeData?.missing)) {
      errors.push(`flashcards-index.${locale}.json: missing must be an array`);
    }
  }

  // 3. exercises-index points at real files and known question ids
  for (const ex of exIndex) {
    if (!ids.has(ex.qid)) errors.push(`exercise ${ex.exerciseId} references unknown qid ${ex.qid}`);
    if (!existsSync(resolve(OUT_DIR, ex.path))) errors.push(`exercise path missing: ${ex.path}`);
  }

  // 4. facets non-empty
  const categories = new Set(index.map((q) => q.category));
  const stages = new Set(index.map((q) => q.stage));
  if (categories.size === 0) errors.push('no categories');
  if (stages.size === 0) errors.push('no stages');

  // 5. duplicate / near-duplicate titles (warning only)
  const byNorm = new Map();
  for (const q of index) {
    const key = normalizeTitle(q.title);
    const list = byNorm.get(key) ?? [];
    list.push(q.id);
    byNorm.set(key, list);
  }
  for (const [key, list] of byNorm) {
    if (list.length > 1) warnings.push(`duplicate title "${key}" -> q${list.join(', q')}`);
  }

  console.log(
    `Checked ${index.length} questions, ${exIndex.length} exercises, ${categories.size} categories, ${stages.size} stages.`,
  );
  if (warnings.length) {
    console.log(`\nWarnings (${warnings.length}):`);
    for (const w of warnings.slice(0, 30)) console.log('  ~', w);
  }
  if (errors.length) {
    console.log(`\nErrors (${errors.length}):`);
    for (const e of errors.slice(0, 50)) console.log('  !', e);
    process.exit(1);
  }
  console.log('\nOK: all invariants hold.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
