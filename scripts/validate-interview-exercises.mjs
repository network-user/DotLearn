import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT_DIR = resolve(ROOT, 'interview');

const ID_RE = /^[a-z0-9-]+$/;
const SLUG_RE = /^[a-z][a-z0-9-]*[a-z0-9]$/;
const EXPECT_KINDS = new Set(['stdout', 'scalar', 'result-set']);

const isStr = (v, min = 1) => typeof v === 'string' && v.length >= min;
const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

function validateBase(ex, errors) {
  if (!isStr(ex.id) || !ID_RE.test(ex.id)) errors.push(`bad id: ${ex.id}`);
  if (!isStr(ex.concept) || !SLUG_RE.test(ex.concept)) errors.push(`${ex.id}: bad concept "${ex.concept}"`);
  if (!isInt(ex.difficulty, 1, 5)) errors.push(`${ex.id}: bad difficulty`);
  if (!isStr(ex.prompt, 5)) errors.push(`${ex.id}: prompt too short`);
}

function validateQuiz(q, errors, ctx) {
  if (!Array.isArray(q.choices) || q.choices.length < 2) {
    errors.push(`${ctx}: choices < 2`);
    return;
  }
  const ids = new Set();
  for (const c of q.choices) {
    if (!isStr(c.id) || !isStr(c.text)) errors.push(`${ctx}: choice missing id/text`);
    ids.add(c.id);
  }
  if (!Array.isArray(q.correct) || q.correct.length < 1) errors.push(`${ctx}: correct empty`);
  else for (const c of q.correct) if (!ids.has(c)) errors.push(`${ctx}: correct "${c}" not a choice id`);
}

function placeholders(template) {
  const out = new Set();
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  let m;
  while ((m = re.exec(template))) out.add(m[1]);
  return out;
}

function validateExercise(ex, errors) {
  validateBase(ex, errors);
  const ctx = ex.id;
  switch (ex.type) {
    case 'theory-quiz': {
      validateQuiz(ex, errors, ctx);
      if (ex.variants) ex.variants.forEach((v, i) => validateQuiz(v, errors, `${ctx}.variant[${i}]`));
      break;
    }
    case 'predict-output': {
      if (!isStr(ex.snippet)) errors.push(`${ctx}: snippet missing`);
      if (!ex.expected || !EXPECT_KINDS.has(ex.expected.kind)) errors.push(`${ctx}: bad expected.kind`);
      break;
    }
    case 'fill-in-blanks': {
      if (!isStr(ex.template)) errors.push(`${ctx}: template missing`);
      if (!ex.blanks || typeof ex.blanks !== 'object') errors.push(`${ctx}: blanks missing`);
      else {
        const ph = placeholders(ex.template || '');
        for (const key of Object.keys(ex.blanks)) {
          const spec = ex.blanks[key];
          const hasAccept = Array.isArray(spec?.accept) && spec.accept.length > 0;
          const hasRegex = isStr(spec?.accept_regex);
          if (!hasAccept && !hasRegex) errors.push(`${ctx}: blank "${key}" has no accept/accept_regex`);
          if (!ph.has(key)) errors.push(`${ctx}: blank "${key}" not in template`);
        }
        for (const key of ph) if (!(key in ex.blanks)) errors.push(`${ctx}: placeholder "${key}" has no blank spec`);
      }
      break;
    }
    case 'python-function':
    case 'javascript-function': {
      if (!isStr(ex.starter)) errors.push(`${ctx}: starter missing`);
      if (!isStr(ex.solution)) errors.push(`${ctx}: solution missing`);
      if (!Array.isArray(ex.cases) || ex.cases.length < 1) errors.push(`${ctx}: cases missing`);
      else for (const c of ex.cases) if (!isStr(c.call)) errors.push(`${ctx}: case missing call`);
      break;
    }
    case 'sql-query': {
      if (!isStr(ex.fixture)) errors.push(`${ctx}: fixture missing`);
      if (!isStr(ex.solution)) errors.push(`${ctx}: solution missing`);
      break;
    }
    default:
      errors.push(`${ctx}: unknown type "${ex.type}"`);
  }
}

async function isDir(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function main() {
  const names = await readdir(OUT_DIR);
  let files = 0;
  let exercises = 0;
  const badFiles = [];
  for (const cat of names) {
    const dir = resolve(OUT_DIR, cat);
    if (!(await isDir(dir))) continue;
    for (const file of await readdir(dir)) {
      if (!file.endsWith('.exercises.json')) continue;
      files += 1;
      const path = `${cat}/${file}`;
      let data;
      try {
        data = JSON.parse(await readFile(resolve(dir, file), 'utf-8'));
      } catch (err) {
        badFiles.push({ path, errors: [`JSON parse error: ${err.message}`] });
        continue;
      }
      const errors = [];
      if (!data || !Array.isArray(data.exercises) || data.exercises.length < 1) {
        errors.push('no exercises array');
      } else {
        const ids = new Set();
        for (const ex of data.exercises) {
          exercises += 1;
          if (ids.has(ex.id)) errors.push(`duplicate id ${ex.id}`);
          ids.add(ex.id);
          validateExercise(ex, errors);
        }
      }
      if (errors.length) badFiles.push({ path, errors });
    }
  }
  console.log(`Checked ${files} files, ${exercises} exercises. Invalid files: ${badFiles.length}`);
  for (const b of badFiles) {
    console.log(`\n:: ${b.path}`);
    for (const e of b.errors.slice(0, 8)) console.log(`   - ${e}`);
  }
  if (badFiles.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
