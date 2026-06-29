# Handoff prompt — DotLearn

Copy the block below into a fresh chat with Cursor or Claude Code at the repository root (`<repo-root>`). It briefs the next agent on context, conventions, and the first concrete tasks.

---

## Prompt

You are continuing work on **DotLearn**, a local-first, AI-extensible learning workbench. The repository is at `<repo-root>`. A previous agent laid the foundation (architecture, contracts, scaffold, skill, one demo topic). Your job is to take it from "scaffold" to "Phase 1 MVP" as defined in `ROADMAP.md`.

### Read first (in this order)

1. `README.md` — vision and quickstart
2. `ARCHITECTURE.md` — invariants and structure
3. `ROADMAP.md` — phase definitions (you are starting Phase 1)
4. `CLAUDE.md` if you are Claude Code, or `.cursor/rules/dotcore-project.mdc` if you are Cursor
5. `AGENTS.md` — universal conventions
6. `.cursor/skills/lesson-forge/SKILL.md` (or `.claude/skills/lesson-forge/SKILL.md`) — the topic-generation skill, your main tool for content work
7. `packages/contracts/src/*.schema.ts` — the source-of-truth Zod schemas
8. `topics/sql-fundamentals/` — the reference implementation of the topic contract

### Project status (as of handoff)

Already in place:

- pnpm/Turborepo monorepo: `apps/web`, `apps/api`, `packages/contracts`
- `packages/contracts` with full Zod schemas: TopicManifest, Exercise (6 variants), Flashcard, Submission
- `apps/web` skeleton (Vite + React + TS + Tailwind + TanStack Router): Home, Topic, Submit, Admin pages; topics auto-discovered via `import.meta.glob`; `+ Add topic` button in header
- `apps/api` NestJS skeleton with Layered DDD: `submissions` module (controller, service, in-memory repository, entity); `admin/submissions` controller for review; Swagger; pino logging; global response interceptor and exception filter; Zod body pipe
- `lesson-forge` Cursor + Claude Code skill, mirrored, with reference docs, JSON schemas, and templates
- `pnpm sync:skills` + `pnpm check:skills` to keep the mirror honest
- One demo topic: `topics/sql-fundamentals/` (3 concepts, 11 exercises, sql.js runtime)

Not yet in place:

- `packages/lesson-engine` (topic loader + exercise runner)
- `packages/sandbox` (real sql.js + Pyodide adapters in Web Workers)
- MDX rendering on the topic page (currently shows curriculum only)
- Per-exercise progress in IndexedDB
- `pnpm validate` actually executing gold solutions (currently only checks schema and file references)
- Persistent repository for `apps/api` (currently in-memory)
- GitHub Action that runs `pnpm validate` on PRs touching `topics/**`

### Your goals — Phase 1

Execute the items in `ROADMAP.md` under "Phase 1 — Minimum Viable Player". Specifically, in order:

1. **`packages/lesson-engine`**
   - Topic loader that reads any topic directory from disk (Node) or from `import.meta.glob` (browser) and returns a `TopicManifest` plus resolved `theory` and `exercises` contents.
   - Exercise runner with one function per type: `runTheoryQuiz`, `runSqlQuery`, `runPythonFunction`, etc. Each takes a learner-submitted answer plus the exercise and returns `{ ok: boolean; details: ... }`.
   - The runners are isomorphic where possible; the SQL runner expects an injected `SqlRuntime` interface (so it works with sql.js in the browser and `better-sqlite3` in CI/validator).

2. **`packages/sandbox`**
   - `SqlRuntime` interface + `sqlJsRuntime` implementation that initializes sql.js in a Web Worker. Expose `execute(sql, fixture)` returning `{ rows, columns }`.
   - `PyodideRuntime` shimmed; full implementation can wait.

3. **Validator upgrade**
   - Extend `packages/contracts/scripts/validate-topics.ts` so it not only checks schemas but actually executes every `sql-query` exercise's `solution` against the `fixture` using a Node-side SQL engine (`better-sqlite3` is the practical choice). Diff `expected` vs actual. Fail loudly with row-level details.
   - This implements Quality Gate G6 from the skill.

4. **MDX rendering in `apps/web`**
   - Render theory files on the topic page using `@mdx-js/react` with Shiki syntax highlighting.
   - The TopicPage currently shows curriculum; expand to a left rail of concepts and a right pane with the active concept's theory + exercise.

5. **Interactive exercise pane**
   - A SQL exercise renders a Monaco editor + Run button + result table. Submit calls the lesson-engine runner via the `packages/sandbox` worker. Show pass/fail with the diff.

6. **Progress persistence**
   - Use Dexie to store `{ topicSlug, exerciseId, status, lastAttemptAt }` in IndexedDB. Show a checkmark on completed exercises in the curriculum rail.

### Constraints (do not violate)

- **No comments in code.** Express intent via names and types. Comments allowed in MDX prose only.
- **No emojis** in code or content unless I explicitly ask.
- **Topic content is content, not code.** Never make `apps/*` import from `topics/*` directly except through the `packages/lesson-engine` loader.
- **`apps/web` must work without `apps/api`.** Backend is optional enhancement.
- **Backend is NestJS Layered DDD.** When adding a new module, follow the `submissions` module's structure: `domain/`, `infrastructure/`, `dto/`, controller, service, module. Persistence behind injected interfaces.
- **Zod is the single source of truth.** TypeScript types are derived via `z.infer<>`. No duplicate definitions on the API side.
- **Generated content always via the `lesson-forge` skill.** Never invent ad-hoc topic structures.
- **Skill changes go to both `.cursor/skills/lesson-forge/` and `.claude/skills/lesson-forge/`** — or just edit `.cursor/skills/...` and run `pnpm sync:skills`.
- **A new exercise type or runtime is a breaking change.** It requires updating: Zod schema (contracts), runner (lesson-engine), JSON schema in both skill directories, and `reference/exercise-types.md` in both skill directories. One PR, or nothing.
- **Conventional commits.**

### How to verify your work

- `pnpm install` from the repo root.
- `pnpm typecheck` must pass everywhere.
- `pnpm dev:web` should open at `http://localhost:5173` and show the SQL Fundamentals topic, with rendered theory and at least the `sql-query` exercises runnable end-to-end after Phase 1.
- `pnpm dev:api` should start NestJS on `:3000`. Swagger UI at `http://localhost:3000/docs`.
- `pnpm validate` must run gold solutions and pass for `sql-fundamentals` once the validator upgrade is in place.
- `pnpm check:skills` must pass (skill mirror is in sync).

### When to ask, when to proceed

- Ask if you would be making an architectural choice that materially changes `ARCHITECTURE.md` (e.g. swapping NestJS for Fastify, dropping Turborepo).
- Ask if you are about to introduce a new exercise type or runtime.
- Otherwise proceed. The conventions in `CLAUDE.md` / `.cursor/rules/dotcore-project.mdc` / `AGENTS.md` cover the day-to-day decisions.

### Style of working

- Small commits, each compiling and runnable.
- Test the seam between `apps/web` and `packages/lesson-engine` early — the worker boundary is where most bugs hide.
- Prefer extending the existing `submissions` module pattern when adding new API endpoints; don't invent new structural conventions.

When ready, start by reading the files listed above and produce a 5–10 line plan for Phase 1 broken into commits. After I confirm the plan, begin.
