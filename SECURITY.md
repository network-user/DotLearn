# Security model

This document records the threat model and the controls in place. It is the
reference for anyone touching the sandbox, the AI (BYOK) integration, or the API.

## Threat model

The frontend is **local-first**: SQL, Python, and (potentially) JavaScript
exercise code execute entirely in the visitor's own browser. There is **no
server-side execution of user code**. The backend (`apps/api`) only stores
submissions and serves admin endpoints.

Consequences:

- User-submitted exercise code cannot reach the server, other users, or other
  users' data. The realistic risks are (a) freezing the visitor's own tab,
  (b) escaping Web Worker isolation to touch the page's DOM / IndexedDB,
  (c) exfiltrating data from inside a runner over the network.
- The cross-user attack surface lives in **untrusted topic content** (MDX/YAML
  proposed via PR or the in-app form) and in the **backend**.

## Sandbox controls (`packages/sandbox`)

- **Execution timeout + worker recreation.** Each Python (10s) and SQL (5s) run
  races a main-thread timer. On timeout the worker is `terminate()`d and
  recreated on the next call, so an infinite loop (`while True:`, a runaway
  `CROSS JOIN`) cannot permanently kill the feature. See
  `python/runtime.ts`, `sql/runtime.ts`.
- **Python worker hardening.** After Pyodide loads, escape globals are
  neutralized in the worker scope: `fetch`, `XMLHttpRequest`, `WebSocket`,
  `EventSource`, `importScripts`, `indexedDB`, `caches`, `Worker`,
  `SharedWorker`, `BroadcastChannel`, `postMessage`, plus `navigator.sendBeacon`
  and `navigator.serviceWorker` (a beacon is a self-contained cross-origin POST
  that does not depend on the `fetch` global). This blocks
  `import js; js.fetch(...)` / `js.navigator.sendBeacon(...)` exfiltration.
  Responses use a captured `rawPostMessage`. The neutering lives in a shared
  `harden-worker-scope.ts`, and the **SQL worker now applies the same hardening**
  after `initSqlJs` resolves (previously only Python did), so both
  untrusted-code runners are at parity. The SQL runtime also arms an init
  watchdog (like Python) so a stalled `initSqlJs` cannot wedge SQL exercises
  with no recovery.
- **Per-run namespace isolation.** Each evaluation runs in a fresh Python globals
  dict (`runPython(source, { globals })`), so definitions, imports, and
  `__builtins__` monkeypatching from one run cannot poison a later grading run.
- **Output cap.** Python stdout is truncated at 100k characters.
- **Known limit: no memory cap.** The timeout kills runaway CPU/loops, but not
  allocation: `x = [0] * 10**9` or a `WITH RECURSIVE` blow-up can OOM the worker
  (and tab) before `terminate()` fires. The `terminate`+recreate path restores
  the feature on the next call.
- **Self-hosted Pyodide, fail-closed.** Pyodide runtime assets are served
  same-origin from `/pyodide/` (emitted at build, served by a dev middleware),
  never a public CDN. The worker now **refuses to load** without a same-origin
  `indexUrl` (no CDN fallback), and `connect-src` (below) does not list any CDN,
  so a regressed fallback would be blocked at the policy layer too. Worker
  messages are validated against the protocol shape before dispatch. See
  `pyodideAssetsPlugin` in `apps/web/vite.config.ts` and `ensurePyodide` in
  `python/worker.ts`.
- **JavaScript runner is fail-closed.** `inlineJavascriptRuntime`
  (`packages/lesson-engine`) uses `new Function` and **throws if run on a
  browser main thread**. There is intentionally no JS exercise runner in the
  web app: adding one requires a dedicated Web Worker, and that worker's
  `new Function` would force `'unsafe-eval'` into the CSP. Make that a conscious
  decision before shipping JS exercises.

## Web app controls (`apps/web`)

- **Content Security Policy + security headers.** The full header set
  (`Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options: DENY`,
  `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`,
  `Cross-Origin-Opener-Policy`) is served as real response headers by the edge in
  both deployment paths: the recommended bare-metal path serves them from
  `deploy/Caddyfile`, and the Docker/nginx path from
  `apps/web/security-headers.conf`, re-`include`d in every `location` so a
  per-location `add_header` cannot drop them. The CSP is a real header on both,
  so `frame-ancestors 'none'` is enforced (not only the `X-Frame-Options: DENY`
  fallback). A `<meta>` CSP (`cspPlugin`, `apply: 'build'`) is kept as
  belt-and-suspenders for static hosts, but `frame-ancestors`/HSTS are
  spec-ignored in `<meta>` and rely on the real headers. `public/_headers`
  mirrors the policy for Netlify/Cloudflare hosts. Keep the Caddyfile, nginx
  conf, and `_headers` in sync. Key directives: `script-src 'self' 'wasm-unsafe-eval'`
  (no `unsafe-eval`), `object-src 'none'`, `frame-ancestors 'none'`,
  `worker-src 'self' blob:`.
  - `connect-src` is `'self'` only. The SPA and API are same-origin in every
    deployment path: the bare-metal path proxies `/api` through Caddy, and the
    Docker image proxies `/api` through nginx (`apps/web/nginx.conf`) to the
    `api` service - so no cross-origin host is needed. The site is **pure-logic
    with no runtime AI** (see below), so the former provider hosts
    (`api.anthropic.com`, `api.openai.com`, `openrouter.ai`) were removed: with
    no runtime path to them they were pure data-exfiltration surface for any
    future XSS foothold. A genuinely cross-origin backend would have to be added
    to the policy by the deployer. Keep the three copies (`vite.config.ts`,
    `security-headers.conf`, `public/_headers`) in sync - `scripts/check-csp-sync.mjs`
    enforces it, and they match `deploy/Caddyfile`; `_headers` also carries HSTS
    to match the nginx image.
- **No runtime AI / BYOK.** The running app performs no LLM calls and stores no
  provider keys. The former BYOK scaffolding (`lib/provider-credentials.ts`,
  `lib/crypto-store.ts`, the `providerCredentials` / `cryptoKeys` IndexedDB
  stores, and the `@dotlearn/ai-providers` dependency in `apps/web`) has been
  removed; the Dexie schema (v14) drops those stores on upgrade. LLMs are used
  only offline for content generation.
- **Untrusted link hrefs are scheme-filtered.** Links whose href comes from
  topic content (MDX prose, manifest `sources`, image `src`) pass through
  `lib/safe-url.ts` (`isSafeHref`): only `http(s)`, `mailto:`, same-page
  fragments and site-relative paths render; `javascript:` / `data:` are dropped.
  The contract additionally rejects non-http(s) source URLs at `pnpm validate`.
- **Topic-supplied regex is bounded.** `accept_regex` (fill-in-blanks) is capped
  in length and rejected if it contains nested quantifiers (ReDoS shape) by the
  contract, and the runner skips matching over-long answers, so a malicious
  topic cannot freeze the visitor's tab.
- **Progress import is bounded.** The import path caps file size, per-table
  record counts, and free-text field lengths before writing to IndexedDB, so a
  crafted "backup" cannot exhaust the origin's storage quota.
- **MDX theory is executable.** Topic MDX compiles to JS and runs in every
  visitor's browser. It is trusted only because it passes PR review +
  `pnpm validate`. Treat topic content as code in review.

## Backend controls (`apps/api`)

- Global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`) +
  `ZodBodyPipe` for contract payloads.
- CORS restricted to an allowlist from `WEB_ORIGIN`.
- Admin auth: password hash + TOTP + JWT secrets from env, throttling. No
  secrets in code.
  - **TOTP anti-replay:** each successful code's `timeStep` is persisted and
    passed as `afterTimeStep` on the next verify, so a code cannot be replayed
    within its acceptance window. The window is RFC-compliant past-only
    (`epochTolerance: [1, 0]`), not the previous symmetric ±30 steps.
  - **JWT hardening:** algorithm is pinned to `HS256` on sign and verify;
    `ADMIN_REFRESH_SECRET` is now **required and must differ** from
    `ADMIN_JWT_SECRET`, so a leaked access secret cannot forge refresh tokens.
  - **Refresh-token reuse detection:** presenting an already-rotated (revoked)
    refresh token is treated as theft - the session epoch is bumped (killing
    every outstanding token for that subject) and the request is rejected.
  - **Logout revokes the access token:** the logout route is guarded so the
    access `jti` is revoked, not just the refresh cookie.
  - **Durable auth state:** revoked token jtis, session epochs, consumed backup
    codes, and TOTP timesteps survive a restart (persisted via the JSON file
    store), so `logout`/`logout-all` and one-time backup codes are not undone by
    a process restart.
  - **Lockout is DoS-resistant:** a wrong username/password does **not** count
    toward account lockout (that would let an unauthenticated attacker lock the
    admin out); only a TOTP failure after a correct password escalates lockout.
    Password guessing is bounded by the per-route throttle.
- Rate limiting: global `ThrottlerGuard` (100/min); public `POST /submissions`
  tightened to 5/min; the public read/search/suggest routes carry a per-route
  throttle (30/min) and `GET /submissions` is paginated (`limit`/`offset`).
  `trust proxy` is env-gated (`TRUSTED_PROXY_HOPS`, default 0) so the throttler
  keys per real client IP only when a known hop count is configured.
- **Response headers + Swagger:** `x-powered-by` is disabled and the API sets
  `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
  `Cross-Origin-Opener-Policy` (and HSTS in production). Swagger is mounted only
  when `NODE_ENV !== 'production'`, so the admin surface is not enumerable in a
  prod image.
- **Search DoS bound:** the fuzzy matcher caps query/token length and skips the
  Levenshtein DP when token lengths differ by more than the fuzziness threshold,
  so an over-long query cannot pin the event loop.
- **Storage bounds:** the public submission store is capped
  (`SUBMISSIONS_MAX`, default 5000) and each `sources` URL is length-bounded, so
  disk growth is bounded. On boot, a corrupt submissions/hidden-topics file is
  quarantined (`.corrupt.<ts>`) and the service continues; a corrupt
  **auth-state** file (revoked tokens, session epochs, consumed backup codes)
  is fail-secure (refuses to start) rather than silently resurrecting revoked
  sessions. Durable-write failures are logged, not swallowed.
- No `child_process` / shell execution; submissions are not written to disk by
  user-controlled paths.

## Build & deploy trust boundary

- **The build runs as root; the runtime does not.** `scripts/deploy.sh` runs
  `pnpm install --frozen-lockfile` and the per-package builds as root, so a
  dependency's lifecycle (`postinstall`) script executes as uid 0 at build time.
  This is a deliberate trade-off for the one-command bare-metal deploy. The
  runtime is fully de-privileged (systemd `User=dotlearn`, `NoNewPrivileges`,
  empty `CapabilityBoundingSet`, `ProtectSystem=strict`), but the build is not.
  Trust rests on the pinned `pnpm-lock.yaml`: **review lock-file diffs before
  deploying**, and on shared hosts consider running the install/build as a
  dedicated unprivileged user.
- **Secret files are never world-readable.** `deploy.sh` sets `umask 077` up
  front and writes the env file at `/etc/dotlearn/dotlearn.env` (mode 600, owned
  by root), so admin secrets (password hash, TOTP secret, JWT/refresh secrets,
  backup-code hashes) are not exposed even transiently during creation. The
  static site (`/var/www/dotlearn`) and API data (`/var/lib/dotlearn/data`) carry
  no secrets.

## Still needs manual (in-browser) verification

- CSP does not break Pyodide / Monaco at runtime in a production build.
- Timeout path: a `while True:` Python exercise errors after ~10s and the next
  run works (worker was recreated).
- Self-hosted Pyodide loads from `/pyodide/` with no CDN requests.

## Reporting

Report vulnerabilities privately to the maintainer rather than opening a public
issue.
