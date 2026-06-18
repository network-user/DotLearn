import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT_DIR = resolve(ROOT, 'interview');

const unquote = (value) => {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return trimmed;
};

function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return undefined;
  const data = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    data[key] = unquote(line.slice(idx + 1));
  }
  return data;
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
  const index = [];
  const exercisesIndex = [];

  for (const category of names) {
    const dir = resolve(OUT_DIR, category);
    if (!(await isDir(dir))) continue;
    const entries = await readdir(dir);
    for (const file of entries) {
      if (!file.endsWith('.ru.mdx')) continue;
      const id = Number(file.replace('.ru.mdx', ''));
      const text = await readFile(resolve(dir, file), 'utf-8');
      const fm = parseFrontmatter(text);
      if (!fm) {
        console.warn(`No frontmatter: ${category}/${file}`);
        continue;
      }

      let exerciseCount = 0;
      const exFile = resolve(dir, `${id}.exercises.json`);
      if (entries.includes(`${id}.exercises.json`)) {
        try {
          const parsed = JSON.parse(await readFile(exFile, 'utf-8'));
          const list = Array.isArray(parsed?.exercises) ? parsed.exercises : [];
          const valid = list.filter(
            (ex) =>
              typeof ex?.id === 'string' &&
              /^[a-z0-9-]+$/.test(ex.id) &&
              typeof ex?.type === 'string' &&
              Number.isInteger(ex?.difficulty) &&
              ex.difficulty >= 1 &&
              ex.difficulty <= 5,
          );
          exerciseCount = valid.length;
          for (const ex of valid) {
            exercisesIndex.push({
              exerciseId: ex.id,
              qid: id,
              category: fm.category,
              categoryLabel: fm.categoryLabel,
              stage: fm.stage,
              stageLabel: fm.stageLabel,
              type: ex.type,
              difficulty: ex.difficulty,
              path: `${category}/${id}.exercises.json`,
            });
          }
        } catch (err) {
          console.warn(`Bad exercises JSON: ${category}/${id}.exercises.json -> ${err}`);
        }
      }

      let titleEn;
      if (entries.includes(`${id}.en.mdx`)) {
        try {
          const enFm = parseFrontmatter(await readFile(resolve(dir, `${id}.en.mdx`), 'utf-8'));
          if (enFm?.title) titleEn = enFm.title;
        } catch {
          titleEn = undefined;
        }
      }

      index.push({
        id,
        title: fm.title,
        ...(titleEn ? { titleEn } : {}),
        category: fm.category,
        categoryLabel: fm.categoryLabel,
        stage: fm.stage,
        stageLabel: fm.stageLabel,
        exerciseCount,
        path: `${category}/${file}`,
      });
    }
  }

  index.sort((a, b) => a.category.localeCompare(b.category) || a.id - b.id);
  exercisesIndex.sort(
    (a, b) =>
      a.category.localeCompare(b.category) ||
      a.qid - b.qid ||
      a.exerciseId.localeCompare(b.exerciseId),
  );

  await writeFile(resolve(OUT_DIR, 'index.json'), JSON.stringify(index, null, 2) + '\n', 'utf-8');
  await writeFile(
    resolve(OUT_DIR, 'exercises-index.json'),
    JSON.stringify(exercisesIndex, null, 2) + '\n',
    'utf-8',
  );
  console.log(
    `Rebuilt index.json (${index.length} questions) and exercises-index.json (${exercisesIndex.length} exercises).`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
