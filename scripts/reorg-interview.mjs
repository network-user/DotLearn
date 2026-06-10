import { readdir, readFile, rename, mkdir, rmdir, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT_DIR = resolve(ROOT, 'interview');

const KNOWN = new Set([
  'python-core',
  'data-structures',
  'oop-patterns',
  'concurrency',
  'data-storage',
  'web-networking',
  'frameworks',
  'infrastructure',
  'system-design',
  'quality-process',
]);

function frontmatterCategory(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return undefined;
  for (const line of match[1].split('\n')) {
    const m = line.match(/^category:\s*(.+)$/);
    if (m) return m[1].trim().replace(/^"|"$/g, '');
  }
  return undefined;
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
  let moved = 0;
  const unknown = new Set();

  for (const oldCat of names) {
    const dir = resolve(OUT_DIR, oldCat);
    if (!(await isDir(dir))) continue;
    const files = await readdir(dir);
    for (const file of files) {
      if (!file.endsWith('.ru.mdx')) continue;
      const id = file.replace('.ru.mdx', '');
      const text = await readFile(resolve(dir, file), 'utf-8');
      const newCat = frontmatterCategory(text);
      if (!newCat) {
        console.warn(`No category in ${oldCat}/${file}`);
        continue;
      }
      if (!KNOWN.has(newCat)) unknown.add(newCat);
      if (newCat === oldCat) continue;
      const targetDir = resolve(OUT_DIR, newCat);
      await mkdir(targetDir, { recursive: true });
      await rename(resolve(dir, file), resolve(targetDir, file));
      const exFile = `${id}.exercises.json`;
      if (files.includes(exFile)) {
        await rename(resolve(dir, exFile), resolve(targetDir, exFile));
      }
      moved += 1;
    }
  }

  for (const oldCat of names) {
    const dir = resolve(OUT_DIR, oldCat);
    if (!(await isDir(dir))) continue;
    const remaining = await readdir(dir);
    if (remaining.length === 0) {
      await rmdir(dir);
      console.log(`removed empty dir ${oldCat}`);
    }
  }

  console.log(`Moved ${moved} files.`);
  if (unknown.size) {
    console.warn(`WARNING unknown categories present: ${[...unknown].join(', ')}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
