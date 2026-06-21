import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const localesDir = join(here, '..', 'apps', 'web', 'src', 'locales');

const load = (name) => JSON.parse(readFileSync(join(localesDir, name), 'utf8'));

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

// i18next plural categories differ per locale (ru has few/many, en only one/other),
// so compare base keys with the plural suffix stripped — a feature must exist in both
// files, even if each carries its own set of CLDR plural forms.
const PLURAL_SUFFIXES = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);

const baseKey = (key) => {
  const cut = key.lastIndexOf('_');
  if (cut === -1) return key;
  return PLURAL_SUFFIXES.has(key.slice(cut + 1)) ? key.slice(0, cut) : key;
};

const baseSet = (keys) => new Set([...keys].map(baseKey));

const ru = baseSet(flatten(load('ru.json')));
const en = baseSet(flatten(load('en.json')));

const ruOnly = [...ru].filter((k) => !en.has(k)).sort();
const enOnly = [...en].filter((k) => !ru.has(k)).sort();

if (ruOnly.length === 0 && enOnly.length === 0) {
  console.log(`i18n parity OK — ${ru.size} base keys in both ru.json and en.json`);
  process.exit(0);
}

console.error('i18n parity FAILED — every key must exist in both ru.json and en.json.\n');
if (ruOnly.length > 0) {
  console.error(`Missing from en.json (${ruOnly.length}):`);
  for (const k of ruOnly) console.error(`  ${k}`);
  console.error('');
}
if (enOnly.length > 0) {
  console.error(`Missing from ru.json (${enOnly.length}):`);
  for (const k of enOnly) console.error(`  ${k}`);
  console.error('');
}
process.exit(1);
