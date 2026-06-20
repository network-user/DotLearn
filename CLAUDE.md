# DotLearn — guide for Claude Code

This file is auto-loaded by Claude Code. It mirrors the project conventions kept under `.cursor/rules/` so the same agent behavior applies in either tool.

## What this repo is

A local-first, AI-extensible learning workbench. Each topic under `topics/<slug>/` is a self-contained module: theory in MDX, exercises in YAML, all validated against Zod schemas in `packages/contracts`. The frontend (`apps/web`) runs without a backend; the optional backend (`apps/api`) provides submission and admin endpoints. See `README.md`, `ARCHITECTURE.md`, and `ROADMAP.md` for the full picture.

## How to add a topic

Always invoke the `lesson-forge` skill at `.claude/skills/lesson-forge/SKILL.md`. The skill encodes the topic contract, the validation pipeline, and the curriculum-planning workflow. **Do not generate topic content without following the skill.**

The same skill is available to Cursor at `.cursor/skills/lesson-forge/`. Both directories contain identical content and are kept in sync by `pnpm sync:skills`.

## Architecture rules

- **Monorepo:** pnpm workspaces + Turborepo. Frontend (`apps/web`) and backend (`apps/api`) never import from each other directly. Shared types live in `packages/contracts`.
- **Local-first:** the frontend must work with the backend absent. Topics are loaded via `import.meta.glob`, sandbox runs in Web Workers, AI calls use BYOK keys stored in IndexedDB.
- **Topics are content, not code.** They never import from `apps/*`.
- **Zod is the single source of truth** for schemas. TypeScript types are derived via `z.infer<>`.

## Backend conventions (`apps/api`)

NestJS with Layered DDD:

- Modules under `src/modules/<domain>/`
- Each module has `domain/`, `infrastructure/`, `dto/`, controller, service, module
- Controllers handle HTTP only; business logic lives in services; persistence behind injected interfaces
- Validation with `class-validator` (whitelist + transform) and the `ZodBodyPipe` for endpoints that take payloads defined in `@dotlearn/contracts`
- Global response interceptor + exception filter for consistent envelopes
- Swagger decorators on every endpoint
- Structured logging via `nestjs-pino` (no `console.log`)
- Future financial operations must use a ledger pattern + idempotency service

## Frontend conventions (`apps/web`)

- React 18 + TypeScript strict, functional components only
- Vite for dev/build
- TanStack Router
- Tailwind CSS, no inline styles except where Tailwind cannot reach
- Sandbox in `packages/sandbox`, executed in Web Workers
- AI calls via `packages/ai-providers` (BYOK)

### Responsive design (mobile + desktop, mandatory)

Every new page or component is designed for **both mobile and desktop in the same change**:

- Mobile-first Tailwind: base classes target narrow screens, `sm:`/`md:`/`lg:`/`xl:` widen the layout.
- Touch targets >= 44px via the `--tap` / `--tap-comfort` tokens; primary action buttons full-width on mobile (`w-full sm:w-auto` or `flex-1 sm:flex-initial`).
- Text inputs: 16px font on mobile (`text-[16px] sm:text-sm` or the shared `form-input` class) — prevents iOS Safari focus zoom.
- Hover must not be load-bearing: Tailwind runs with `future.hoverOnlyWhenSupported`; pointer-tracking effects (GlassSurface) bail out on touch devices.
- Below `md`, `BottomTabBar` is the primary navigation; do not place fixed UI in its zone (`--mobile-tabbar-h` + `--safe-bottom`).
- Wide content (tables, grids, viz) scrolls inside `overflow-x-auto`; never force horizontal page scroll. `min-w-*` only behind a breakpoint prefix.
- Check 375px and 1280px in device emulation before calling UI work done.

### Content-loading budget

- Topic content (MDX theory, YAML exercises) and heavy dependencies (Monaco editor, sql.js, pyodide) load lazily. Never add an eager `import.meta.glob` over `topics/**`; never statically import a heavy editor/runtime into a shared chunk (use `LazyCodeEditor` / the lazy runtimes).
- Routes are code-split via `React.lazy` in `router.tsx`; only `HomePage` lives in the entry chunk.
- List pages (home, progress) take per-topic exercise counts from the build-time `virtual:topic-stats` module instead of loading full topic bundles.

## Internationalization (i18n)

DotLearn is bilingual: **Russian is primary and the fallback language; English is secondary**. The runtime locale is detected from `localStorage` → `navigator.language`, defaulting to `ru` when neither yields `ru`/`en`. Users can override it via the switcher in the header or on `/settings`.

**Russian context in content.** The material is read in a Russian setting. When a topic example needs a name, city, company, currency, or identifier, default to Russian realia (Анна/Борис, Москва/Казань, Яндекс/Сбер/Госуслуги/Ozon, рубли, ИНН/СНИЛС). This is a soft default for relatability, not a mandate - don't contort universal CS examples to force it, and keep established English technical terms in English. Material must also stay engaging and moderate (no filler, hook over definition, interactive visualizations). Both rules live in `.claude/skills/lesson-forge/reference/content-style-guide.md` (_Engagement and moderation_ and _When generating in Russian_).

### Adding UI strings

- Strings live in `apps/web/src/locales/{ru,en}.json`, organized by namespace (`common`, `nav`, `home`, `topic`, `progress`, `settings`, `admin`, `submit`, `runners`, `errors`, `heatmap`, `theme`, `addTopic`). Add a key to **both** files; never ship a key in one and not the other.
- In components, use `const { t } = useTranslation('<namespace>')` and `t('key.path')`. For embedded markup, use `<Trans i18nKey="ns:key" components={...} />`.
- For values that need a fallback chain on a dynamic key, pass `defaultValue` to `t()`.
- Never hardcode a user-facing string. Toasts, ARIA labels, placeholders, and error messages all go through `t()`.

### Multilingual topics

- `TopicManifest` declares `availableLanguages: ("en" | "ru")[]` (deduplicated, non-empty) and `primaryLanguage` (must be in `availableLanguages`). The primary is the original-language content and serves as the per-topic fallback.
- File naming: `theory/<NN>-<concept-id>.<lang>.mdx` and `exercises/<NN>-<concept-id>.<lang>.yaml`. Each concept must have one file per language listed in `availableLanguages`.
- Exercise `id` values are shared across language variants of the same exercise — translation, not duplication.
- The topic loader (`apps/web/src/lib/topics.ts`) is locale-aware: it filters concept files by the current locale and falls back to `primaryLanguage` when the requested locale is unavailable. `TopicPage` shows an amber banner when the fallback kicks in.
- `HomePage` renders one badge per available language on each topic card.

### Editing the contract

Any change to language fields or file-suffix conventions is a **breaking change**. Required steps, in one PR:

1. Update `packages/contracts/src/topic.schema.ts` (Zod) and `submission.schema.ts` if proposal shape changes.
2. Update `apps/web/src/lib/topics.ts` resolver.
3. Update both `.claude/skills/lesson-forge/schemas/manifest.schema.json` and `.cursor/skills/lesson-forge/schemas/manifest.schema.json`.
4. Update `reference/topic-contract.md` and `reference/quality-gates.md` in both skill locations.
5. Migrate every existing topic under `topics/` so `pnpm validate` stays green.
6. Run `pnpm sync:skills` (and `pnpm typecheck` + `pnpm validate`).

## Code style

- **No comments in code.** Express intent through names and types. Comments allowed in MDX prose only, not in fenced code blocks.
- **No emojis** in code or content unless the user explicitly asks.
- **Names are descriptive:** `submissionStatus`, not `s`.
- **Typed errors.** Throw domain-specific error classes, not bare `Error`.

## Testing

The repo uses **vitest**. Run everything with `pnpm test` (Turborepo runs each package's `test`); per package: `pnpm --filter @dotlearn/<pkg> test`, watch mode via `test:watch`. Tests are co-located as `src/**/*.spec.ts` with `import { describe, it, expect } from 'vitest'` (globals are off). Existing suites: `packages/lesson-engine` (answer grading, value/row comparison, loader), `packages/contracts` (Zod schemas), `apps/api` (domain services).

- **Maintain the suite as part of the change, not after.** When you add or modify logic that is (or should be) tested, add/update the matching `*.spec.ts` and keep `pnpm test` green. Changing `packages/contracts` schemas or `packages/lesson-engine` grading/loader without touching their specs is incomplete work.
- **Test where it earns its keep — not everywhere.** Cover pure, deterministic logic with real failure modes: answer grading/comparison, schema validation and invariants, loaders/resolvers, backend domain services, and any non-obvious algorithm. A bug there is silent and user-facing, so it's worth a test. Trivial glue, thin wrappers, and presentational markup are not.
- **Do not** add component-render or Playwright e2e tests by default. For this solo, local-first project without a CI e2e gate their maintenance cost outweighs the value; write them only when explicitly asked.
- Keep tests deterministic: no network, no real heavy runtimes. Inject fakes (e.g. `inlineJavascriptRuntime` for JS exercises; never spin up pyodide/sql.js in a unit test). Validate a meaningful test by checking it fails when the code it guards is broken.

## Extending the contract

A new exercise `type` or runtime is a **breaking change**. Required steps, in one PR:

1. Add the Zod variant to `packages/contracts/src/exercise.schema.ts`
2. Add the runner to `packages/lesson-engine/src/runners/`
3. Add `*.spec.ts` for the new runner and the schema variant; keep `pnpm test` green
4. Update `.cursor/skills/lesson-forge/schemas/exercise.schema.json` and `.claude/skills/lesson-forge/schemas/exercise.schema.json`
5. Update `reference/exercise-types.md` in both skill locations
6. Run `pnpm sync:skills`

Do not start unless you can finish all steps in the same change.

## Submission flow

Users propose topics via:

- **GitHub PR** under `topics/<slug>/` (CI runs `pnpm validate`)
- **In-app form** at `/submit` → POST `/api/submissions` → maintainer reviews at `/admin`

Both routes converge on the same approval step. After approval, the maintainer (or an agent on their behalf) materializes the topic via `lesson-forge`.

## Commits

- Conventional commits
- One topic per commit when adding content
- Squash agent-generated noise

## README and lines-of-code counter

- The repo README follows the `generate-readme` skill (`.cursor/skills/generate-readme/`, mirrored to `.claude/` via `pnpm sync:skills`; personal copy in `~/.codex/skills/`). Regenerate through the skill - do not hand-write README. README ends at `## Архитектура`. DotBioSite card copy goes to `docs/portfolio-draft.md`, not README.
- At the end of every session, refresh the lines-of-code count in `README.md` between the `<!-- loc:start -->` and `<!-- loc:end -->` markers: run `pip install code-counter-ntwusr` (Python 3.12+, git) once, then `code-counter .` from the repo root, take the `TOTAL` value and write it into the badge. Never invent the number; if `code-counter` is unavailable, count git-tracked sources and note the method.

## When in doubt

Refer to:

- `README.md` — vision and quickstart
- `ARCHITECTURE.md` — diagrams and invariants
- `ROADMAP.md` — what's in and out of scope for each phase
- `CONTRIBUTING.md` — topic submission rules
- `docs/NEXT_AGENT_PROMPT.md` — exact handoff prompt for the next agent
