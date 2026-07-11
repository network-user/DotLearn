import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { createPythonNodeRuntime } from '../runtime/python-node';

const ROOT = resolve(process.cwd(), '..', '..');
const TOPICS_DIR = resolve(ROOT, 'topics');
const OUTPUT_PATH = resolve(ROOT, 'apps', 'web', 'src', 'generated', 'demo-outputs.json');

const MAX_STORED_CHARS = 4000;
const MAX_BLOCK_LINES = 80;
const MAX_BLOCK_CHARS = 4000;

/**
 * Stable hash of a theory code block — MUST stay byte-identical to
 * apps/web/src/lib/demo-outputs.ts (hashDemoCode). Any divergence makes the
 * browser lookup silently miss, so the "показать результат" button never shows.
 * FNV-1a, 32-bit, hex, over a CRLF->LF + trailing-whitespace-stripped string.
 */
const hashDemoCode = (code: string): string => {
  const canon = code.replace(/\r\n/g, '\n').replace(/\s+$/, '');
  let h = 0x811c9dc5;
  for (let i = 0; i < canon.length; i += 1) {
    h ^= canon.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
};

// Obviously non-stdlib / heavy / networked modules. Reject a block if it imports
// any of these. sqlite3 IS available in pyodide and is intentionally absent.
const DENYLIST = new Set([
  'numpy',
  'pandas',
  'scipy',
  'matplotlib',
  'torch',
  'tensorflow',
  'sklearn',
  'requests',
  'httpx',
  'aiohttp',
  'fastapi',
  'starlette',
  'django',
  'flask',
  'litestar',
  'pydantic',
  'sqlalchemy',
  'boto3',
  'celery',
  'redis',
  'kafka',
  'pika',
  'jinja2',
  'bs4',
  'lxml',
  'PIL',
  'cv2',
  'yaml',
  'ultralytics',
  'torchvision',
  'transformers',
  'onnx',
  'onnxruntime',
  'keras',
]);

interface CodeBlock {
  code: string;
  origin: string;
}

interface FencedBlock {
  lang: string;
  code: string;
}

/**
 * Line-based fenced-code scanner. A block opens on a line whose trimmed text
 * starts with ``` followed by a language token, and closes on the next line
 * whose trimmed text is exactly ```. Inner lines are captured verbatim (no
 * dedent, no reformatting) so their join matches the rendered <pre>.textContent.
 */
const extractFences = (content: string): FencedBlock[] => {
  const lines = content.split(/\r?\n/);
  const blocks: FencedBlock[] = [];
  let index = 0;
  while (index < lines.length) {
    const trimmed = (lines[index] ?? '').trim();
    if (!trimmed.startsWith('```')) {
      index += 1;
      continue;
    }
    const lang = trimmed.slice(3).trim().split(/\s+/)[0] ?? '';
    const inner: string[] = [];
    let cursor = index + 1;
    let closed = false;
    for (; cursor < lines.length; cursor += 1) {
      if ((lines[cursor] ?? '').trim() === '```') {
        closed = true;
        break;
      }
      inner.push(lines[cursor] ?? '');
    }
    if (!closed) {
      break;
    }
    blocks.push({ lang: lang.toLowerCase(), code: inner.join('\n') });
    index = cursor + 1;
  }
  return blocks;
};

const importedModules = (code: string): string[] => {
  const modules: string[] = [];
  for (const raw of code.split(/\r?\n/)) {
    const line = raw.trim();
    const importMatch = /^import\s+(.+)$/.exec(line);
    if (importMatch && importMatch[1]) {
      for (const part of importMatch[1].split(',')) {
        const name = part
          .trim()
          .split(/\s+as\s+/)[0]
          ?.trim()
          .split('.')[0];
        if (name) {
          modules.push(name);
        }
      }
      continue;
    }
    const fromMatch = /^from\s+([a-zA-Z0-9_.]+)\s+import\b/.exec(line);
    if (fromMatch && fromMatch[1]) {
      modules.push(fromMatch[1].split('.')[0] ?? fromMatch[1]);
    }
  }
  return modules;
};

/**
 * Returns the reason a block is unsafe / non-deterministic / non-runnable, or
 * null when it is a safe candidate. Conservative by design: when unsure, skip.
 */
const staticSkipReason = (code: string): string | null => {
  if (code.includes('...')) {
    return 'ellipsis-or-incomplete';
  }
  if (/(^|\n)[ \t]*#\s*(no-run|noqa:\s*run)\b/.test(code)) {
    return 'no-run-marker';
  }
  if (importedModules(code).some((module) => DENYLIST.has(module))) {
    return 'third-party-import';
  }
  // Could hang or block the synchronous runtime.
  if (/\binput\s*\(/.test(code)) {
    return 'blocking-or-hang';
  }
  if (/\bwhile\s+True\s*:/.test(code) && !/\bbreak\b/.test(code)) {
    return 'blocking-or-hang';
  }
  if (/\btime\.sleep\s*\(/.test(code)) {
    return 'blocking-or-hang';
  }
  if (/\b(import\s+threading|threading\.)/.test(code)) {
    return 'blocking-or-hang';
  }
  if (/\b(import\s+asyncio|asyncio\.)/.test(code)) {
    return 'blocking-or-hang';
  }
  if (/\bsocket\b/.test(code)) {
    return 'blocking-or-hang';
  }
  if (/\bsubprocess\b/.test(code)) {
    return 'blocking-or-hang';
  }
  if (/\bos\.system\s*\(/.test(code)) {
    return 'blocking-or-hang';
  }
  if (/\bopen\s*\(/.test(code)) {
    return 'blocking-or-hang';
  }
  // The logging module keeps a process-global logger registry: getLogger(name)
  // returns the same singleton across blocks, so handlers/levels accumulate in
  // the shared runtime and output becomes execution-order dependent (and most
  // records go to stderr, which we never capture). Never a stable prepared answer.
  if (/\blogging\b/.test(code)) {
    return 'stateful-logging';
  }
  // Non-deterministic output.
  if (/\brandom\b/.test(code)) {
    return 'non-deterministic';
  }
  if (/\bsecrets\b/.test(code)) {
    return 'non-deterministic';
  }
  if (/\buuid\b/.test(code)) {
    return 'non-deterministic';
  }
  if (/\bos\.urandom\b/.test(code)) {
    return 'non-deterministic';
  }
  if (/\btime\.time\s*\(/.test(code)) {
    return 'non-deterministic';
  }
  if (/\b(perf_counter|monotonic)\b/.test(code)) {
    return 'non-deterministic';
  }
  if (/\.(now|today)\s*\(/.test(code)) {
    return 'non-deterministic';
  }
  if (/\bid\s*\(/.test(code)) {
    return 'non-deterministic';
  }
  // hash() of anything that is not a plain integer literal (str hashing is
  // randomized across interpreter runs).
  if (/\bhash\s*\((?!\s*-?\d+\s*\))/.test(code)) {
    return 'non-deterministic';
  }
  const lineCount = code.split('\n').length;
  if (lineCount > MAX_BLOCK_LINES || code.length > MAX_BLOCK_CHARS) {
    return 'too-large';
  }
  return null;
};

const topicRuntime = async (slug: string): Promise<string | undefined> => {
  const manifestPath = join(TOPICS_DIR, slug, 'manifest.json');
  if (!existsSync(manifestPath)) {
    return undefined;
  }
  try {
    const raw = JSON.parse(await readFile(manifestPath, 'utf-8')) as { runtime?: unknown };
    return typeof raw.runtime === 'string' ? raw.runtime : undefined;
  } catch {
    return undefined;
  }
};

const listSlugs = async (): Promise<string[]> => {
  const entries = await readdir(TOPICS_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
};

const theoryFilenames = async (slug: string): Promise<string[]> => {
  const dir = join(TOPICS_DIR, slug, 'theory');
  if (!existsSync(dir)) {
    return [];
  }
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.mdx'))
    .map((entry) => entry.name)
    .sort();
};

const loadCache = async (): Promise<Record<string, string>> => {
  if (!existsSync(OUTPUT_PATH)) {
    return {};
  }
  try {
    const raw = JSON.parse(await readFile(OUTPUT_PATH, 'utf-8')) as unknown;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      const out: Record<string, string> = {};
      for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof value === 'string') {
          out[key] = value;
        }
      }
      return out;
    }
  } catch {
    return {};
  }
  return {};
};

/**
 * Serialize manually (sorted, 2-space, trailing newline). JSON.stringify would
 * enumerate all-digit hash keys as array indices and reorder them ahead of the
 * rest, breaking the sorted-ascending contract and readable diffs.
 */
const serialize = (data: Record<string, string>): string => {
  const keys = Object.keys(data).sort();
  if (keys.length === 0) {
    return '{}\n';
  }
  const body = keys
    .map((key) => `  ${JSON.stringify(key)}: ${JSON.stringify(data[key])}`)
    .join(',\n');
  return `{\n${body}\n}\n`;
};

const bump = (counter: Record<string, number>, key: string): void => {
  counter[key] = (counter[key] ?? 0) + 1;
};

const main = async (): Promise<number> => {
  if (!existsSync(TOPICS_DIR)) {
    console.log('No topics/ directory. Nothing to precompute.');
    return 0;
  }

  const allSlugs = await listSlugs();
  const pyodideSlugs: string[] = [];
  for (const slug of allSlugs) {
    if ((await topicRuntime(slug)) === 'pyodide') {
      pyodideSlugs.push(slug);
    }
  }

  const unique = new Map<string, CodeBlock>();
  let theoryFilesRead = 0;
  let pythonOccurrences = 0;

  for (const slug of pyodideSlugs) {
    for (const filename of await theoryFilenames(slug)) {
      theoryFilesRead += 1;
      const content = await readFile(join(TOPICS_DIR, slug, 'theory', filename), 'utf-8');
      for (const block of extractFences(content)) {
        if (block.lang !== 'python' && block.lang !== 'py') {
          continue;
        }
        pythonOccurrences += 1;
        const hash = hashDemoCode(block.code);
        if (!unique.has(hash)) {
          unique.set(hash, { code: block.code, origin: `${slug}/theory/${filename}` });
        }
      }
    }
  }

  const staticSkips: Record<string, number> = {};
  const runnable = new Map<string, CodeBlock>();
  for (const [hash, block] of unique) {
    const reason = staticSkipReason(block.code);
    if (reason) {
      bump(staticSkips, reason);
      continue;
    }
    runnable.set(hash, block);
  }

  const cache = await loadCache();
  const result: Record<string, string> = {};
  const runtimeSkips: Record<string, number> = {};
  let reused = 0;
  let executed = 0;
  let produced = 0;
  let firstExecError: string | undefined;

  const runtime = createPythonNodeRuntime();
  for (const [hash, block] of runnable) {
    if (hash in cache) {
      result[hash] = cache[hash] as string;
      reused += 1;
      continue;
    }
    executed += 1;
    const firstLine = (block.code.split('\n')[0] ?? '').slice(0, 60);
    console.log(`[exec] ${hash} ${block.origin} :: ${firstLine}`);
    let stdout: string;
    let thrown: { type: string; message: string } | undefined;
    try {
      const exec = await runtime.evaluate(block.code, 'None');
      stdout = exec.stdout;
      thrown = exec.thrown;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (firstExecError === undefined) {
        firstExecError = message;
      }
      console.warn(`  ! ${hash} runtime error: ${message}`);
      bump(runtimeSkips, 'runtime-error');
      continue;
    }
    if (thrown) {
      bump(runtimeSkips, 'raised');
      continue;
    }
    if (!stdout || stdout.trim() === '') {
      bump(runtimeSkips, 'empty-output');
      continue;
    }
    if (/0x[0-9a-fA-F]{6,}/.test(stdout)) {
      bump(runtimeSkips, 'address-in-output');
      continue;
    }
    let stored = stdout;
    if (stored.length > MAX_STORED_CHARS) {
      stored = `${stored.slice(0, MAX_STORED_CHARS)}\n…(output truncated)`;
    }
    result[hash] = stored;
    produced += 1;
  }

  const pruned = Object.keys(cache).filter((key) => !(key in result)).length;

  await writeFile(OUTPUT_PATH, serialize(result), 'utf-8');

  const summarize = (label: string, counter: Record<string, number>): void => {
    const keys = Object.keys(counter).sort();
    if (keys.length === 0) {
      console.log(`${label} none`);
      return;
    }
    console.log(label);
    for (const key of keys) {
      console.log(`    ${key}: ${counter[key]}`);
    }
  };

  console.log('\n=== precompute-demo-outputs summary ===');
  console.log(`  topics scanned:      ${allSlugs.length}`);
  console.log(`  pyodide topics:      ${pyodideSlugs.length}`);
  console.log(`  theory files read:   ${theoryFilesRead}`);
  console.log(`  python blocks found: ${pythonOccurrences}`);
  console.log(`  unique blocks:       ${unique.size}`);
  summarize('  skipped (static):', staticSkips);
  console.log(`  runnable candidates: ${runnable.size}`);
  console.log(`  reused from cache:   ${reused}`);
  console.log(`  executed:            ${executed}`);
  console.log(`  produced output:     ${produced}`);
  summarize('  skipped (runtime):', runtimeSkips);
  console.log(`  pruned stale:        ${pruned}`);
  console.log(`  final entries:       ${Object.keys(result).length}`);
  console.log(`  written to:          ${OUTPUT_PATH}`);
  if (firstExecError !== undefined) {
    console.warn(`\n  note: first runtime error was: ${firstExecError}`);
  }

  return 0;
};

main().then((code) => process.exit(code));
