# Architecture

## Overview

DotLearn is a **modular monolith inside a pnpm workspaces monorepo**. The frontend and backend live in the same repository but in different workspace packages with no implicit boundaries crossed.

```
┌──────────────────────────────────────────────────────────────────┐
│              Cursor agent      ←→      Claude Code agent         │
│  .cursor/skills/lesson-forge/        .claude/skills/lesson-forge/│
│                  (mirrored, pnpm sync:skills)                    │
└────────────────────────────┬─────────────────────────────────────┘
                             │ generates / validates
                             ▼
                  ┌──────────────────────┐
                  │      topics/         │  content authored by skill
                  │  sql-fundamentals/   │  (manifest.json + theory + exercises)
                  │  python-oop/         │
                  └──────────┬───────────┘
                             │ loaded by
                             ▼
┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
│   apps/web       │   │ packages/contracts│   │   apps/api       │
│ Vite + React     │◄──┤ Zod schemas + TS │──►│  NestJS (DDD)    │
│ local-first      │   │ types (shared)   │   │  submissions     │
│ BYOK AI in       │   └──────────────────┘   │  admin           │
│ browser          │           ▲              │  ai-proxy (opt)  │
└────────┬─────────┘           │              └──────────────────┘
         │                     │
         ▼                     │
┌──────────────────┐           │
│ packages/sandbox │           │
│ sql.js + Pyodide │───────────┘
│ in Web Workers   │
└──────────────────┘
```

## Key invariants

1. **`apps/web` must run with `apps/api` absent.** Local-first means the SPA reads `topics/` directly (Vite `import.meta.glob`), runs sandbox in Web Workers, and calls AI providers from the browser via BYOK. The backend is _optional enhancement_, never _required dependency_.

2. **`packages/contracts` is the only thing that touches both worlds.** Web validates topic manifests with the same Zod schemas the API uses for incoming submission DTOs. `z.infer<>` keeps TypeScript types synchronized for free.

3. **Topics never import from `apps/*`.** A topic's manifest can reference custom `sandbox.tsx` only when truly needed; the rest of the topic is data. This is what makes forks merge cleanly.

4. **`lesson-forge` skill owns the contract.** Any change to the topic shape requires editing the skill's schemas + reference docs + templates in one transaction. The skill is the source of truth for "how to produce a valid topic".

5. **`.cursor/skills/lesson-forge/` is the canonical skill source.** It is mirrored to `.claude/skills/lesson-forge/` by `scripts/sync-skills.mjs` so the same skill activates in Cursor and Claude Code. CI runs `pnpm check:skills` to enforce sync. `AGENTS.md` at the root reuses the same conventions for any other AI agent (Aider, Continue, etc.).

## Why a modular monolith (and not...)

| Alternative                                              | Why rejected                                                                                                                              |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Single flat package                                      | Agent codegen drifts; no separation between UI and domain logic; violates the user's NestJS DDD rule on backend side.                     |
| Next.js full-stack (single app)                          | Couples frontend deploy to backend lifecycle; harder to self-host static-only; mixes API routes into UI code.                             |
| Polyrepo (separate frontend / backend / contracts repos) | Skill needs to see everything in one place; PR-based topic submissions become awkward across repos; type sync requires manual versioning. |

The modular monolith captures the local-first philosophy (frontend independent) while preserving DDD boundaries on the backend.

## NestJS backend rules

Per project conventions, the backend follows Layered DDD:

- `apps/api/src/modules/<domain>/` — one folder per bounded context (submissions, admin, ai-proxy, topics)
- Each module has `domain/`, `infrastructure/`, `dto/`, controller, service, module
- Controllers do only request/response mapping
- Services hold business logic
- Infrastructure is hidden behind interfaces injected via abstract classes
- Validation via `class-validator` with strict whitelisting
- Global response interceptor + exception filter for consistent envelopes
- Swagger decorators on every endpoint
- Structured logger (pino), never `console.log`

When financial operations are introduced (future marketplace, sponsorships), the ledger pattern and idempotency service kick in — but this is post-MVP.

## Frontend conventions

- React 18 + TypeScript strict
- Vite for dev/build; static deployable to Cloudflare Pages or any CDN
- Tailwind for styling
- TanStack Router for routing
- Topic discovery via `import.meta.glob('/topics/*/manifest.json', { eager: true })`
- All AI calls go through `packages/ai-providers` (BYOK)
- All secrets (API keys) live in IndexedDB, never on a server

## Sandbox isolation

Code execution lives in `packages/sandbox`:

- SQL → `sql.js` (SQLite WASM) running in a Web Worker
- Python → `Pyodide` in a Web Worker
- JavaScript → constrained `new Function` sandbox
- Future: Judge0-backed runtimes via `apps/api` for languages WASM can't yet host well

Each runtime exposes the same `Runtime.execute(prompt: string, fixture: string): RuntimeResult` interface so the exercise runner doesn't care which language is underneath.

## Submission flow

```
┌──────────────────┐                ┌──────────────────┐
│  GitHub fork +   │                │ Site "+ Topic"   │
│   PR with new    │                │     dialog       │
│   topic folder   │                │ (free text)      │
└────────┬─────────┘                └────────┬─────────┘
         │                                   │
         │  CI runs `pnpm validate`          │  POST /api/submissions
         │                                   │
         ▼                                   ▼
┌──────────────────────────────────────────────────┐
│  Maintainer review at /admin                     │
│  (web app, read submissions from apps/api)       │
└──────────┬───────────────────────────────────────┘
           │ approved
           ▼
┌──────────────────────────────────────────────────┐
│  Topic merged into main / published              │
└──────────────────────────────────────────────────┘
```

Both routes share the **same review surface**, which keeps moderation simple.
