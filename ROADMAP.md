# Roadmap

## Phase 0 — Foundation [done]

- [x] Monorepo skeleton (pnpm workspaces + Turborepo)
- [x] `packages/contracts` with Zod topic schema
- [x] `apps/web` Vite + React scaffold
- [x] `apps/api` NestJS scaffold with submissions module
- [x] `.cursor/skills/lesson-forge` with full contract docs and templates
- [x] One demo topic (`sql-fundamentals`) to validate the contract
- [x] Topic submission UI placeholder + admin route placeholder

## Phase 1 — Minimum Viable Player [done]

- [x] `packages/lesson-engine`: isomorphic topic loader + 6 exercise runners + runtime interfaces
- [x] `packages/sandbox`: sql.js in Web Worker, real Pyodide in Web Worker (loaded from CDN)
- [x] Theory rendering with MDX and Shiki syntax highlighting
- [x] Interactive exercise pane: Monaco editor for SQL + Python, runners for all 6 exercise types
- [x] Per-exercise progress in IndexedDB (Dexie)
- [x] FSRS-4.5 spaced repetition scheduler (deck UI lands with the first topic that ships flashcards)
- [x] Validator CLI: `pnpm validate` walks `topics/**`, executes every `sql-query` gold solution in sql.js and diffs against `expected.rows` (Quality Gate G6)
- [x] Second topic (`python-oop`) generated through lesson-forge as an E2E proof
- [x] Light/dark theme via CSS-variable tokens, toggle in header, persisted in localStorage
- [x] `packages/ai-providers`: BYOK abstraction for OpenAI/Anthropic/Ollama/OpenRouter with `testConnection` per provider; `/settings` page; keys stored in IndexedDB only
- [x] UI polish: error boundary, toast notifications (sonner), breadcrumbs, progress bars on topic cards, GitHub-style activity heatmap on `/progress`

### Carried into Phase 2

- AI providers' `generateTopic` / `generateExercises` are still stubs (`throw ProviderError('not implemented yet')`) — they need real prompt engineering.
- Flashcard deck UI — wait for the first topic shipping `flashcards/*.yaml`.
- Resizable split panel on TopicPage — current grid layout fixes the rail at 260px.
- Bundle splitting — Monaco currently lives in the main chunk; lazy-loading it would cut first-paint.
- Lint pass — Phase 1 closed with passing `typecheck`, `validate`, `build`, but `pnpm lint` was not run in the same session.

## Phase 2 — Codegen loop (1–2 weeks)

- [ ] `lesson-forge` integrated end-to-end against real providers: agent generates → validator passes → PR opened
- [ ] `generateTopic` / `generateExercises` filled in for at least one provider (likely Anthropic)
- [ ] Streaming / progress reporting for long generations
- [ ] Lint pass + ESLint config for `topics/**/*.{mdx,yaml}` (markdown/yaml lint)
- [ ] Monaco lazy-loaded via dynamic import to cut the main chunk

## Phase 3 — Submissions + admin (1 week)

- [ ] `apps/api` submissions endpoint: create + list + review (approve/reject) — currently in-memory, move to persistent repository
- [ ] In-app `+ Add topic` dialog wired to the API end-to-end
- [ ] `/admin` page in `apps/web` showing pending submissions
- [ ] Email notifications when a submission is approved (later)
- [ ] GitHub Action: on PR touching `topics/**`, run `pnpm validate` and label the PR

## Phase 4 — Polish + community (open-ended)

- [ ] PWA / offline support (Pyodide bundle is the bottleneck — needs local copy under `public/`)
- [ ] Topic catalog page with search + tags
- [ ] LOOM-style knowledge graph linking concepts across topics
- [ ] Export/import progress as JSON
- [ ] Public catalog of community-approved topics (read from main branch)
- [ ] Resizable split panel on TopicPage
- [ ] Flashcard deck UI (driven by first topic that ships flashcards)
- [ ] i18n for UI strings (the topic contract already supports `language` for content)

## Explicitly NOT in scope for MVP

- Authentication / user accounts (BYOK keeps things stateless)
- Monetization (BYOK eliminates AI cost pass-through)
- Marketplace for paid topics
- Mobile apps
- Real Postgres / Judge0 server-side sandboxes (Pyodide + sql.js cover 95% of needs)
