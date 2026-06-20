# AGENTS.md

Universal entry point for any AI coding agent (Cursor, Claude Code, GitHub Copilot Workspace, Aider, Continue, etc.) working in this repository. Tool-specific files (`CLAUDE.md`, `.cursor/rules/`, `.aider.conf.yml`, etc.) re-state these conventions in their own formats — this file is the authoritative summary.

## Skills

The repository ships skills under two parallel directories, kept in sync:

- `.cursor/skills/<name>/SKILL.md` for Cursor
- `.claude/skills/<name>/SKILL.md` for Claude Code

Currently available:

- **`lesson-forge`** — generate a new learning topic. Activate when the user asks to add a topic, create lessons, generate exercises, or build a course. Full instructions in either skill directory.
- **`generate-readme`** — regenerate `README.md` (DotCore internal doc) and project agent rules (`AGENTS.md` in other repos; here keep this file as monorepo canon, update via skill merge). README ends at `## Архитектура`. DotBioSite card copy goes to `docs/portfolio-draft.md`, not README. Full workflow in either skill directory.

If you cannot natively load skills (e.g. you are a CLI agent), read `.claude/skills/lesson-forge/SKILL.md` manually and follow the workflow inside it.

## Project rules (essential)

1. **Local-first.** `apps/web` runs without `apps/api`. Topics are read from disk via `import.meta.glob`. AI calls are BYOK from the browser.
2. **Modular monolith.** `apps/web` and `apps/api` are separate workspaces; they communicate only via the contracts in `packages/contracts`.
3. **No comments in code.** Express intent in names and types. MDX prose is fine; fenced code blocks should not contain explanatory comments.
4. **No emojis** unless the user explicitly asks.
5. **NestJS DDD** on the backend: domain/infrastructure/dto/controller/service/module per module.
6. **Topics never import from `apps/*`.** They are content.
7. **Zod is the single source of truth for schemas.** TypeScript types via `z.infer<>`.
8. **A new exercise type or runtime is a breaking change** and must update contracts + lesson-engine + both skill schemas + the catalog doc in one PR.

## How to make a code change

1. Check `ROADMAP.md` to see whether the change is in scope for the current phase.
2. Locate the right workspace (`apps/web`, `apps/api`, `packages/<name>`).
3. Run `pnpm typecheck` after editing and `pnpm validate` if topics were touched.
4. Conventional commits, one topical change per commit.

## How to add a topic

Use the `lesson-forge` skill. Never invent a topic structure ad-hoc.

## Where to find things

| Looking for                          | Path                                                                              |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| Vision and quickstart                | `README.md`                                                                       |
| Architecture diagrams and invariants | `ARCHITECTURE.md`                                                                 |
| Phased plan                          | `ROADMAP.md`                                                                      |
| Topic submission rules               | `CONTRIBUTING.md`                                                                 |
| Project-wide AI rules                | `.cursor/rules/dotlearn.mdc` and `CLAUDE.md`                                      |
| Handoff prompt for the next agent    | `docs/NEXT_AGENT_PROMPT.md`                                                       |
| Zod schemas                          | `packages/contracts/src/*.schema.ts`                                              |
| JSON schemas (for skill consumption) | `.cursor/skills/lesson-forge/schemas/` and `.claude/skills/lesson-forge/schemas/` |
