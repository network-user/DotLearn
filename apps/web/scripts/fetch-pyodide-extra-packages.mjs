#!/usr/bin/env node
// Runs as apps/web's "prebuild" (see package.json) so every build - CI's bare
// `pnpm build`, the Dockerfile's `pnpm --filter @dotlearn/web build`, and local
// dev - gets the extra Pyodide packages the same way, instead of only the
// Dockerfile knowing to fetch them (that gap is what broke the CI build).
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolvePyodideDir, resolvePyodideExtraPackageEntries } from '../pyodide-packages.mjs';

let pyodideDir;
try {
  pyodideDir = resolvePyodideDir(dirname(fileURLToPath(import.meta.url)));
} catch (error) {
  console.log(
    `[fetch-pyodide-extra-packages] pyodide is not installed, skipping: ${error.message}`,
  );
  process.exit(0);
}

const { version } = JSON.parse(readFileSync(join(pyodideDir, 'package.json'), 'utf8'));
const entries = resolvePyodideExtraPackageEntries(pyodideDir);

for (const entry of entries) {
  const target = join(pyodideDir, entry.file_name);
  if (existsSync(target)) {
    console.log(`[fetch-pyodide-extra-packages] ${entry.file_name} already present, skipping.`);
    continue;
  }
  const url = `https://cdn.jsdelivr.net/pyodide/v${version}/full/${entry.file_name}`;
  console.log(`[fetch-pyodide-extra-packages] downloading ${entry.file_name} from ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  if (sha256 !== entry.sha256) {
    throw new Error(
      `Checksum mismatch for ${entry.file_name}: expected ${entry.sha256}, got ${sha256}`,
    );
  }
  writeFileSync(target, buffer);
  console.log(`[fetch-pyodide-extra-packages] verified sha256, wrote ${entry.file_name}`);
}
