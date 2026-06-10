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
  Responses use a captured `rawPostMessage`. See `python/worker.ts`
  (`hardenWorkerScope`).
- **Per-run namespace isolation.** Each evaluation runs in a fresh Python globals
  dict (`runPython(source, { globals })`), so definitions, imports, and
  `__builtins__` monkeypatching from one run cannot poison a later grading run.
- **Output cap.** Python stdout is truncated at 100k characters.
- **Known limit — no memory cap.** The timeout kills runaway CPU/loops, but not
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

- **Content Security Policy + security headers.** The production nginx image
  serves the full header set (`Content-Security-Policy`, `Strict-Transport-Security`,
  `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`, `Cross-Origin-Opener-Policy`) from
  `apps/web/security-headers.conf`, re-`include`d in every `location` so a
  per-location `add_header` cannot drop them. A `<meta>` CSP (`cspPlugin`,
  `apply: 'build'`) is kept as a belt-and-suspenders for non-nginx hosts, but
  `frame-ancestors`/HSTS are spec-ignored in `<meta>` and rely on the real
  headers. `public/_headers` mirrors the policy for Netlify/Cloudflare hosts.
  Keep all three in sync. Key directives: `script-src 'self' 'wasm-unsafe-eval'`
  (no `unsafe-eval`), `object-src 'none'`, `frame-ancestors 'none'`,
  `worker-src 'self' blob:`.
  - `connect-src` is an **allowlist**: `'self'`, the four built-in provider
    hosts (`api.anthropic.com`, `api.openai.com`, `openrouter.ai`,
    `localhost:*` for Ollama), and localhost websockets for dev. The previous
    blanket `https:` gave any XSS foothold an open channel to exfiltrate
    decrypted BYOK keys to any host; the allowlist closes that. A user pointing
    a provider at a custom host outside the allowlist must have the deployer
    extend the policy — an intentional security/flexibility trade-off.
- **BYOK key encryption at rest.** API keys are encrypted with a non-extractable
  AES-GCM key (Web Crypto) before being written to IndexedDB; see
  `lib/crypto-store.ts`, wired through `lib/provider-credentials.ts`. Legacy
  plaintext keys are read transparently and re-encrypted on next save.
  - Limits: this defeats casual inspection and at-rest plaintext exposure. It
    does **not** defend against XSS (which can call decrypt) or a full browser
    profile copy. The primary XSS defense is the CSP above.
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
  - **Durable auth state:** revoked token jtis, session epochs, consumed backup
    codes, and TOTP timesteps survive a restart (persisted via the JSON file
    store), so `logout`/`logout-all` and one-time backup codes are not undone by
    a process restart.
  - **Lockout is DoS-resistant:** a wrong username/password does **not** count
    toward account lockout (that would let an unauthenticated attacker lock the
    admin out); only a TOTP failure after a correct password escalates lockout.
    Password guessing is bounded by the per-route throttle.
- Rate limiting: global `ThrottlerGuard` (100/min); public `POST /submissions`
  tightened to 5/min.
- No `child_process` / shell execution; submissions are not written to disk by
  user-controlled paths.

## Still needs manual (in-browser) verification

- CSP does not break Pyodide / Monaco at runtime in a production build.
- Timeout path: a `while True:` Python exercise errors after ~10s and the next
  run works (worker was recreated).
- Self-hosted Pyodide loads from `/pyodide/` with no CDN requests.

## Reporting

Report vulnerabilities privately to the maintainer rather than opening a public
issue.
