import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const WEB = resolve(ROOT, 'apps', 'web');

const norm = (value) => value.trim().replace(/\s+/g, ' ');

const read = (relative) => readFile(resolve(WEB, relative), 'utf8');
const readRoot = (relative) => readFile(resolve(ROOT, relative), 'utf8');

// apps/web/vite.config.ts -> the CONTENT_SECURITY_POLICY array, joined like the runtime does.
const cspFromViteConfig = (source) => {
  const block = source.match(/const CONTENT_SECURITY_POLICY = \[([\s\S]*?)\]\.join/);
  if (!block) return null;
  const parts = [...block[1].matchAll(/"([^"]*)"/g)].map((m) => m[1]);
  return parts.length > 0 ? norm(parts.join('; ')) : null;
};

// deploy/Caddyfile -> the Content-Security-Policy served as a real response header on bare-metal.
const cspFromCaddyfile = (source) => {
  const m = source.match(/Content-Security-Policy\s+"([^"]*)"/);
  return m ? norm(m[1]) : null;
};

// apps/web/security-headers.conf -> map of nginx add_header name -> value.
const headersFromNginxConf = (source) => {
  const map = new Map();
  for (const m of source.matchAll(/add_header\s+(\S+)\s+"([^"]*)"/g)) {
    map.set(m[1], norm(m[2]));
  }
  return map;
};

// apps/web/public/_headers -> map of header name -> value within the `/*` block.
const headersFromNetlifyFile = (source) => {
  const map = new Map();
  let inRootBlock = false;
  for (const rawLine of source.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (/^\/\S*/.test(trimmed)) {
      inRootBlock = trimmed === '/*';
      continue;
    }
    if (!inRootBlock || trimmed === '' || trimmed.startsWith('#')) continue;
    const m = rawLine.match(/^\s+([A-Za-z][A-Za-z-]*):\s*(.+)$/);
    if (m) map.set(m[1], norm(m[2]));
  }
  return map;
};

const connectSrc = (csp) => {
  const m = (csp ?? '').match(/connect-src[^;]*/);
  return m ? norm(m[0]) : null;
};

const fail = (message) => {
  console.error(`check:headers - ${message}`);
  process.exitCode = 1;
};

const [viteSource, nginxSource, netlifySource, caddySource] = await Promise.all([
  read('vite.config.ts'),
  read('security-headers.conf'),
  read('public/_headers'),
  readRoot('deploy/Caddyfile'),
]);

const viteCsp = cspFromViteConfig(viteSource);
const nginxHeaders = headersFromNginxConf(nginxSource);
const netlifyHeaders = headersFromNetlifyFile(netlifySource);
const nginxCsp = nginxHeaders.get('Content-Security-Policy') ?? null;
const netlifyCsp = netlifyHeaders.get('Content-Security-Policy') ?? null;
const caddyCsp = cspFromCaddyfile(caddySource);

if (!viteCsp) fail('could not extract CSP from vite.config.ts');
if (!nginxCsp) fail('could not extract CSP from security-headers.conf');
if (!netlifyCsp) fail('could not extract CSP from public/_headers');
if (!caddyCsp) fail('could not extract CSP from deploy/Caddyfile');

// The full CSP must be identical across all four copies (SPA build + the three served targets).
if (viteCsp && nginxCsp && netlifyCsp && caddyCsp) {
  const csps = {
    'vite.config.ts': viteCsp,
    'security-headers.conf': nginxCsp,
    _headers: netlifyCsp,
    'deploy/Caddyfile': caddyCsp,
  };
  const unique = new Set(Object.values(csps));
  if (unique.size !== 1) {
    fail('Content-Security-Policy is out of sync across the four copies:');
    for (const [file, csp] of Object.entries(csps)) console.error(`  ${file}: ${csp}`);
  }
}

// connect-src specifically must never silently widen in one file only.
const connects = [viteCsp, nginxCsp, netlifyCsp, caddyCsp].map(connectSrc);
if (new Set(connects).size !== 1) {
  fail(`connect-src differs across copies: ${connects.join(' | ')}`);
}

// The served header sets (nginx + Netlify) must match by name, so a header like HSTS
// cannot be present in one and missing in the other. The vite <meta> only carries CSP.
const nginxNames = new Set(nginxHeaders.keys());
const netlifyNames = new Set(netlifyHeaders.keys());
const missingFromNetlify = [...nginxNames].filter((name) => !netlifyNames.has(name));
const missingFromNginx = [...netlifyNames].filter((name) => !nginxNames.has(name));
if (missingFromNetlify.length > 0) {
  fail(
    `headers in security-headers.conf but missing from _headers: ${missingFromNetlify.join(', ')}`,
  );
}
if (missingFromNginx.length > 0) {
  fail(
    `headers in _headers but missing from security-headers.conf: ${missingFromNginx.join(', ')}`,
  );
}

if (process.exitCode) {
  console.error(
    'Security header copies are out of sync. Keep vite.config.ts, security-headers.conf, public/_headers and deploy/Caddyfile aligned.',
  );
} else {
  console.log(
    'Security headers are in sync across vite.config.ts, security-headers.conf, public/_headers and deploy/Caddyfile.',
  );
}
