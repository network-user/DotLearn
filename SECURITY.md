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
  `SharedWorker`, `BroadcastChannel`, `postMessage`. This blocks
  `import js; js.fetch(...)` style network/storage access. Responses use a
  captured `rawPostMessage`. See `python/worker.ts` (`hardenWorkerScope`).
- **Output cap.** Python stdout is truncated at 100k characters.
- **Self-hosted Pyodide.** Pyodide runtime assets are served same-origin from
  `/pyodide/` (emitted at build, served by a dev middleware), not from a public
  CDN. See `pyodideAssetsPlugin` in `apps/web/vite.config.ts`.
- **JavaScript runner is fail-closed.** `inlineJavascriptRuntime`
  (`packages/lesson-engine`) uses `new Function` and **throws if run on a
  browser main thread**. There is intentionally no JS exercise runner in the
  web app: adding one requires a dedicated Web Worker, and that worker's
  `new Function` would force `'unsafe-eval'` into the CSP. Make that a conscious
  decision before shipping JS exercises.

## Web app controls (`apps/web`)

- **Content Security Policy.** Injected as a `<meta>` only in production builds
  (`cspPlugin`, `apply: 'build'`) and mirrored in `public/_headers`. Key
  directives: `script-src 'self' 'wasm-unsafe-eval'` (no `unsafe-eval`,
  `wasm-unsafe-eval` is required by Pyodide/sql.js), `object-src 'none'`,
  `frame-ancestors 'none'`, `worker-src 'self' blob:`.
  - `connect-src` is intentionally broad (`'self' https:` + localhost) because
    BYOK lets users point at arbitrary AI providers and custom base URLs
    (including a local Ollama). **Do not** lock `connect-src` to a fixed
    provider list — it breaks BYOK.
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
- Admin auth: password hash + TOTP + JWT secrets from env, account lockout,
  throttling. No secrets in code.
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
