import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CURSOR_SKILLS = join(ROOT, '.cursor', 'skills');
const CLAUDE_SKILLS = join(ROOT, '.claude', 'skills');

const MIRRORS = [
  { source: CURSOR_SKILLS, target: CLAUDE_SKILLS },
];

const walk = (dir) => {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
};

const ensureDir = (filePath) => {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
};

const sync = ({ source, target }) => {
  const sourceFiles = walk(source);
  let changed = 0;
  let unchanged = 0;
  for (const sourcePath of sourceFiles) {
    const rel = relative(source, sourcePath);
    const targetPath = join(target, rel);
    const sourceBuf = readFileSync(sourcePath);
    if (existsSync(targetPath)) {
      const targetBuf = readFileSync(targetPath);
      if (sourceBuf.equals(targetBuf)) {
        unchanged += 1;
        continue;
      }
    }
    ensureDir(targetPath);
    writeFileSync(targetPath, sourceBuf);
    changed += 1;
    console.log(`  ${rel}`);
  }
  return { changed, unchanged };
};

const check = ({ source, target }) => {
  const sourceFiles = walk(source);
  const drift = [];
  for (const sourcePath of sourceFiles) {
    const rel = relative(source, sourcePath);
    const targetPath = join(target, rel);
    if (!existsSync(targetPath)) {
      drift.push({ rel, reason: 'missing in target' });
      continue;
    }
    const sourceBuf = readFileSync(sourcePath);
    const targetBuf = readFileSync(targetPath);
    if (!sourceBuf.equals(targetBuf)) {
      drift.push({ rel, reason: 'content differs' });
    }
  }
  return drift;
};

const mode = process.argv[2] ?? 'sync';

if (mode === '--check') {
  let total = 0;
  for (const mirror of MIRRORS) {
    const drift = check(mirror);
    if (drift.length > 0) {
      console.error(`Drift detected: ${mirror.source} -> ${mirror.target}`);
      for (const item of drift) console.error(`  ${item.rel} (${item.reason})`);
      total += drift.length;
    }
  }
  if (total > 0) {
    console.error(`\n${total} file(s) out of sync. Run pnpm sync:skills.`);
    process.exit(1);
  }
  console.log('All skill mirrors are in sync.');
  process.exit(0);
}

for (const mirror of MIRRORS) {
  console.log(`Syncing ${mirror.source} -> ${mirror.target}`);
  const result = sync(mirror);
  console.log(`  ${result.changed} updated, ${result.unchanged} unchanged.`);
}
