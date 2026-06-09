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

## Internationalization (i18n)

DotLearn is bilingual: **Russian is primary and the fallback language; English is secondary**. The runtime locale is detected from `localStorage` → `navigator.language`, defaulting to `ru` when neither yields `ru`/`en`. Users can override it via the switcher in the header or on `/settings`.

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

## Extending the contract

A new exercise `type` or runtime is a **breaking change**. Required steps, in one PR:

1. Add the Zod variant to `packages/contracts/src/exercise.schema.ts`
2. Add the runner to `packages/lesson-engine/src/runners/`
3. Update `.cursor/skills/lesson-forge/schemas/exercise.schema.json` and `.claude/skills/lesson-forge/schemas/exercise.schema.json`
4. Update `reference/exercise-types.md` in both skill locations
5. Run `pnpm sync:skills`

Do not start unless you can finish all five steps in the same change.

## Submission flow

Users propose topics via:

- **GitHub PR** under `topics/<slug>/` (CI runs `pnpm validate`)
- **In-app form** at `/submit` → POST `/api/submissions` → maintainer reviews at `/admin`

Both routes converge on the same approval step. After approval, the maintainer (or an agent on their behalf) materializes the topic via `lesson-forge`.

## Commits

- Conventional commits
- One topic per commit when adding content
- Squash agent-generated noise

## When in doubt

Refer to:

- `README.md` — vision and quickstart
- `ARCHITECTURE.md` — diagrams and invariants
- `ROADMAP.md` — what's in and out of scope for each phase
- `CONTRIBUTING.md` — topic submission rules
- `docs/NEXT_AGENT_PROMPT.md` — exact handoff prompt for the next agent
