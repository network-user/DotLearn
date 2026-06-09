import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';

process.chdir('apps/web/src');

const ru = JSON.parse(readFileSync('locales/ru.json', 'utf8'));
const en = JSON.parse(readFileSync('locales/en.json', 'utf8'));

const flatten = (obj, prefix = '') => {
  const out = new Set();
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const p of flatten(v, path)) out.add(p);
    } else {
      out.add(path);
    }
  }
  return out;
};

const ruKeys = flatten(ru);
const enKeys = flatten(en);
const defined = new Set([...ruKeys].filter((k) => enKeys.has(k)));

const walk = (dir) => {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (
      (full.endsWith('.tsx') || full.endsWith('.ts')) &&
      !full.endsWith('.d.ts')
    )
      out.push(full);
  }
  return out;
};

const files = [...walk('pages'), ...walk('components')];

const utPattern = /const\s*\{([^}]+)\}\s*=\s*useTranslation\(\s*['"]([a-zA-Z0-9_]+)['"]\s*\)/g;
const tBindingPattern = /\bt(?:\s*:\s*(\w+))?\b/g;
const tCall = /\b(\w+)\(\s*['"]([a-zA-Z0-9_.:-]+)['"]/g;
const i18nkeyPattern = /i18nKey=\{?['"]([a-zA-Z0-9_.:-]+)['"]/g;
const templateCall = /\b(\w+)\(\s*`([^`]+)`/g;

// per file: map of (var name) -> set of namespaces it could refer to
const missingReports = [];
const dynamicKeys = [];

for (const path of files) {
  const content = readFileSync(path, 'utf8');
  const varNamespaces = {}; // var -> Set<ns>
  for (const m of content.matchAll(utPattern)) {
    const destruct = m[1];
    const ns = m[2];
    for (const tm of destruct.matchAll(tBindingPattern)) {
      const varName = tm[1] || 't';
      if (!varNamespaces[varName]) varNamespaces[varName] = new Set();
      varNamespaces[varName].add(ns);
    }
  }

  for (const m of content.matchAll(tCall)) {
    const fn = m[1];
    const key = m[2];
    if (!(fn in varNamespaces)) continue;
    if (key.includes(':')) {
      const flat = key.replace(':', '.');
      if (!defined.has(flat)) missingReports.push({ path, flat });
      continue;
    }
    const candidates = [...varNamespaces[fn]].map((ns) => `${ns}.${key}`);
    const anyDefined = candidates.some((c) => defined.has(c));
    if (!anyDefined) missingReports.push({ path, flat: candidates.join(' | ') });
  }
  for (const m of content.matchAll(i18nkeyPattern)) {
    const flat = m[1].replace(':', '.');
    if (!defined.has(flat)) missingReports.push({ path, flat });
  }
  for (const m of content.matchAll(templateCall)) {
    const fn = m[1];
    if (!(fn in varNamespaces)) continue;
    const key = m[2];
    for (const ns of varNamespaces[fn]) {
      dynamicKeys.push({ path: basename(path), key: `${ns}.${key}` });
    }
  }
}

const dedup = new Map();
for (const r of missingReports) {
  if (!dedup.has(r.flat)) dedup.set(r.flat, []);
  dedup.get(r.flat).push(basename(r.path));
}

console.log('USED but MISSING in BOTH ru and en (no candidate namespace covers it):');
for (const [flat, files] of [...dedup.entries()].sort()) {
  const unique = [...new Set(files)];
  console.log(`  ${flat}    [${unique.join(', ')}]`);
}
console.log(`\nTotal: ${dedup.size}\n`);
console.log('DYNAMIC template-literal keys (manual review):');
for (const d of dynamicKeys) console.log(`  ${d.key}    [${d.path}]`);
