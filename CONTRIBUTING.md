# Contributing

Two ways to contribute a topic:

## Option A — Pull Request (recommended for technical users)

1. Fork the repo.
2. Run `pnpm install`.
3. Ask Cursor (or any tool-using LLM): "Использовать `lesson-forge`, добавь тему по <subject>". The skill scaffolds `topics/<slug>/` and walks through the contract.
4. Run `pnpm validate` — every exercise's gold solution will be executed in sandbox to verify it matches `expected`.
5. Run `pnpm dev:web` and click through the topic to spot-check the UX.
6. Open a PR. CI runs the same `pnpm validate`.

## Option B — In-app submission

1. Open the deployed site.
2. Click "+ Add topic" (top-right).
3. Fill the proposal form: title, brief outline, target audience, links to sources. No code required.
4. Submit. Your proposal lands in the maintainer's `/admin` queue.
5. If accepted, the maintainer (or an LLM agent acting on their behalf) materializes it via `lesson-forge` and merges.

## Topic contract — short version

Every topic lives under `topics/<slug>/` and must contain:

```
topics/<slug>/
├── manifest.json          # validated by packages/contracts Zod schema
├── README.md
├── theory/<NN>-*.mdx      # ordered lesson files
└── exercises/<NN>-*.yaml  # YAML matching exercise.schema
```

Optional:

```
├── flashcards/deck.yaml
└── sandbox/index.tsx      # only if topic needs a custom interaction UI
```

See `.cursor/skills/lesson-forge/reference/topic-contract.md` for the full specification.

## Rules

1. **No comments in code.** The codebase relies on clear naming and types instead. This applies to TypeScript and YAML payloads.
2. **Every exercise must have a working gold solution.** Validators will execute it.
3. **No imports from `apps/web` or `apps/api` inside topic files.** Topics are content + optional self-contained UI, not part of the app.
4. **Stay within supported exercise types** unless you also extend `packages/contracts` + `packages/lesson-engine`. New runtime types require a coordinated change.
5. **Cite sources** in theory files. We prefer "X says Y [link]" over invented authority.

## Code style

- TypeScript strict mode everywhere.
- Frontend: functional React, no class components, TanStack Router, Tailwind.
- Backend: NestJS with Layered DDD; controllers thin, services hold logic, infrastructure injected via interfaces.
- Validation via Zod (shared) on frontend and `class-validator` on backend DTOs (which re-derive from the Zod schema).
