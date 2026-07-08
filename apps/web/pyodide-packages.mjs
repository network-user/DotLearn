// Extra Pyodide packages shipped to the browser beyond the core runtime (see
// vite.config.ts's pyodideAssetsPlugin for why: sqlite3 is an unvendored stdlib
// module needed by the python-orm topic). Shared between vite.config.ts (asset
// serving/bundling) and scripts/fetch-pyodide-extra-packages.mjs (install-time
// download) so the package list and lock-resolution logic can't drift out of sync
// between the two the way they did when only the Dockerfile got patched.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const PYODIDE_EXTRA_PACKAGES = ['sqlite3'];

const findRepoRoot = (startDir) => {
  let dir = startDir;
  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir)
      throw new Error(`Could not find repo root (pnpm-workspace.yaml) above ${startDir}`);
    dir = parent;
  }
};

// pyodide is a transitive dependency (pulled in via @dotlearn/sandbox), not a
// direct dependency of apps/web, so plain `require.resolve('pyodide/...')`
// from here is not reliable - it depends on which loader is doing the
// resolving (works when Vite bundles vite.config.ts, silently fails from a
// plain `node` script). pnpm's on-disk virtual store layout is stable across
// platforms/CI runners regardless of which package first pulled a dep in, so
// walk that directly instead.
export const resolvePyodideDir = (startDir) => {
  const repoRoot = findRepoRoot(startDir);
  const storeDir = join(repoRoot, 'node_modules', '.pnpm');
  const entry = readdirSync(storeDir).find((name) => name.startsWith('pyodide@'));
  if (!entry) throw new Error(`Could not find a pyodide@* entry under ${storeDir}`);
  return join(storeDir, entry, 'node_modules', 'pyodide');
};

export const readPyodideLock = (pyodideDir) =>
  JSON.parse(readFileSync(join(pyodideDir, 'pyodide-lock.json'), 'utf8'));

// Resolves PYODIDE_EXTRA_PACKAGES plus their transitive `depends` to full lock
// entries (file_name + sha256), pulled straight from pyodide-lock.json.
export const resolvePyodideExtraPackageEntries = (pyodideDir) => {
  const lock = readPyodideLock(pyodideDir);
  const packages = lock.packages ?? {};
  const seen = new Set();
  const entries = [];
  const visit = (name) => {
    if (seen.has(name)) return;
    seen.add(name);
    const entry = packages[name];
    if (!entry) return;
    entries.push(entry);
    for (const dep of entry.depends ?? []) visit(dep);
  };
  for (const name of PYODIDE_EXTRA_PACKAGES) visit(name);
  return entries;
};
