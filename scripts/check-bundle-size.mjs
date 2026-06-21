import { readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const distDir = join(here, '..', 'apps', 'web', 'dist');
const indexHtml = join(distDir, 'index.html');

// Budget for the eager (initial) JS payload the browser must download before the app
// is interactive — entry chunk plus everything it modulepreloads. Heavy runtimes
// (Monaco, Pyodide, sql.js) must stay lazy and never appear here.
// Baseline at introduction was ~329 KB gzip; budget sits ~10% above as a
// regression guard. Re-measure with `pnpm check:bundle` and raise deliberately
// if the shell legitimately grows.
const INITIAL_JS_GZIP_BUDGET = 360 * 1024;
const HEAVY = /(monaco|pyodide|sqljs|sql-wasm)/i;

let html;
try {
  html = readFileSync(indexHtml, 'utf8');
} catch {
  console.error(`check:bundle — no build found at ${indexHtml}. Run \`pnpm build\` first.`);
  process.exit(1);
}

const eager = new Set();
for (const m of html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"/g)) eager.add(m[1]);
for (const m of html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g)) eager.add(m[1]);

const toDistPath = (href) => join(distDir, href.replace(/^\//, ''));

const jsAssets = [...eager].filter((href) => href.endsWith('.js'));
if (jsAssets.length === 0) {
  console.error('check:bundle — could not find any eager module scripts in index.html.');
  process.exit(1);
}

let totalGzip = 0;
const rows = [];
const heavyLeaks = [];
for (const href of jsAssets) {
  const path = toDistPath(href);
  let raw;
  try {
    raw = readFileSync(path);
  } catch {
    console.error(`check:bundle — referenced asset missing on disk: ${href}`);
    process.exit(1);
  }
  const gz = gzipSync(raw).length;
  totalGzip += gz;
  rows.push({ href, raw: statSync(path).size, gz });
  if (HEAVY.test(href)) heavyLeaks.push(href);
}

rows.sort((a, b) => b.gz - a.gz);
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;
console.log('Eager JS payload (gzipped):');
for (const r of rows) console.log(`  ${kb(r.gz).padStart(10)}  ${r.href}`);
console.log(`  ${'—'.repeat(10)}`);
console.log(`  ${kb(totalGzip).padStart(10)}  total  (budget ${kb(INITIAL_JS_GZIP_BUDGET)})`);

let failed = false;
if (heavyLeaks.length > 0) {
  console.error(`\ncheck:bundle FAILED — heavy runtime leaked into the eager payload:`);
  for (const href of heavyLeaks) console.error(`  ${href}`);
  console.error('These must stay lazy (dynamic import / lazy route).');
  failed = true;
}
if (totalGzip > INITIAL_JS_GZIP_BUDGET) {
  console.error(
    `\ncheck:bundle FAILED — eager JS ${kb(totalGzip)} exceeds budget ${kb(INITIAL_JS_GZIP_BUDGET)}.`,
  );
  failed = true;
}
if (failed) process.exit(1);
console.log('\ncheck:bundle OK');
