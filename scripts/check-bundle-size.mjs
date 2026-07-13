import { readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join, posix as pathPosix } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const distDir = join(here, '..', 'apps', 'web', 'dist');
const indexHtml = join(distDir, 'index.html');

// Budget for the eager (initial) JS payload the browser must download before the app
// is interactive — entry chunk plus everything it modulepreloads. Heavy runtimes
// (Monaco, Pyodide, sql.js) must stay lazy and never appear here.
// Baseline at introduction was ~329 KB gzip; budget sits ~10% above as a
// regression guard. Re-measure with `pnpm check:bundle` and raise deliberately
// if the shell legitimately grows.
// 2026-07-11: 360 -> 368 after the next-action/tracks banner landed in the
// HomePage entry chunk (~363 KB). Shrink path if needed: React.lazy the
// NextActionBanner on HomePage or split the topics loader off the entry graph.
// 2026-07-13: 368 -> 372 after /en/interview routes + personalization/sync/
// hidden-topics landed (measured 368.3 KB). Router chunk is eager; interview
// data and pages stay lazy.
const INITIAL_JS_GZIP_BUDGET = 372 * 1024;
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

// Rollup emits static imports of already-built chunks as `from"./x.js"` or a
// side-effect-only `import"./x.js"`. Dynamic imports are `import("./x.js")` and
// must be excluded — they're what keeps heavy chunks lazy. Walk the graph from
// each eager entry so chunks reachable only via a static re-export (not linked
// in index.html as modulepreload) still count against the budget.
const STATIC_IMPORT_RE = /\b(?:from|import)"(\.[^"]+?\.js)"/g;

const collectStaticImports = (href) => {
  const path = toDistPath(href);
  const source = readFileSync(path, 'utf8');
  const dir = pathPosix.dirname(href);
  const found = new Set();
  for (const m of source.matchAll(STATIC_IMPORT_RE)) {
    found.add(pathPosix.normalize(pathPosix.join(dir, m[1])));
  }
  return found;
};

const eagerEntries = [...eager].filter((href) => href.endsWith('.js'));
if (eagerEntries.length === 0) {
  console.error('check:bundle — could not find any eager module scripts in index.html.');
  process.exit(1);
}

const jsAssetSet = new Set(eagerEntries);
const queue = [...eagerEntries];
while (queue.length > 0) {
  const href = queue.shift();
  let imports;
  try {
    imports = collectStaticImports(href);
  } catch {
    console.error(`check:bundle — referenced asset missing on disk: ${href}`);
    process.exit(1);
  }
  for (const imported of imports) {
    if (!jsAssetSet.has(imported)) {
      jsAssetSet.add(imported);
      queue.push(imported);
    }
  }
}
const jsAssets = [...jsAssetSet];

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
