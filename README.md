# DotLearn

A local-first, AI-extensible learning workbench. Each "topic" is a self-contained, type-safe module that bundles theory (MDX), interactive exercises (YAML), and optional custom sandbox UI. You generate new topics by asking your coding agent to use the `lesson-forge` skill — every topic produced by the skill is guaranteed to satisfy the same contract, run in the same player, and merge cleanly into forks.

## Vision

You want to learn SQL → you ask the agent to "create a topic on SQL" → the agent invokes `lesson-forge` → it scaffolds the topic, generates lessons and exercises, validates them against a Zod contract, runs each exercise in the in-browser sandbox to verify the gold solution actually works, and opens a PR. You pull it, read the theory, solve the exercises in the embedded SQL editor. Next month — Python OOP. Same workflow, completely different content, identical UX.

## Why another learning platform

The space is crowded with AI tutors (OpenTutor, DeepTutor, AI-Shifu) and interactive playgrounds (BitLab, LiveCodes, Nexora). They split into two camps:

- **Content-generation platforms** generate JSON/Markdown lessons inside fixed templates. Cannot introduce new interaction types without a developer.
- **Interactive playgrounds** support rich runtimes but ship a static, hand-curated curriculum.

DotLearn occupies the third niche: a **codegen-extensible** platform where the AI agent can introduce both new content *and* new types of interactivity, because each topic is a code-level module, not a row in a database. The Cursor skill `lesson-forge` keeps every agent-generated topic standardized.

## Quickstart

```bash
pnpm install
pnpm dev:web
```

Open http://localhost:5173.

To add a topic, ask **Cursor** or **Claude Code** in this repo:

> «Используй lesson-forge, добавь тему по SQL JOINs»

The skill is mirrored under `.cursor/skills/lesson-forge/` and `.claude/skills/lesson-forge/` so it activates in either tool. It bootstraps `topics/sql-joins/` and walks the agent through the contract. Other agents (Aider, Continue, etc.) can read `AGENTS.md` at the repository root for the same conventions.

## Topic submission flow

There are two ways outsiders can propose a topic:

1. **GitHub PR** — fork, run `lesson-forge` locally, submit a pull request. Quality is validated by CI against the contract.
2. **In-app submission** — the "+ Add topic" button on the site opens a form that POSTs to `apps/api`. Submissions land in an admin queue. The maintainer reviews them at `/admin` and approves or rejects.

Both routes converge on the same review step.

## Project layout

```
DotLearn/
├── apps/
│   ├── web/                  # Vite + React, local-first UI
│   └── api/                  # NestJS, optional backend (submissions, admin)
├── packages/
│   ├── contracts/            # Zod schemas — single source of truth
│   ├── lesson-engine/        # Topic loader + exercise runner
│   ├── sandbox/              # sql.js / Pyodide adapters
│   └── ai-providers/         # BYOK abstraction
├── topics/                   # Content (auto-discovered)
├── .cursor/
│   ├── rules/                # Cursor project-wide AI rules
│   └── skills/lesson-forge/  # Skill for Cursor
├── .claude/
│   └── skills/lesson-forge/  # Skill for Claude Code (mirror)
├── CLAUDE.md                 # auto-loaded by Claude Code
├── AGENTS.md                 # universal agent entry point
└── docs/
```

## Run modes

| Command | What it does |
|---|---|
| `pnpm dev:web` | Frontend only. Works fully offline once topics are loaded. BYOK in browser. |
| `pnpm dev:api` | NestJS API for submissions / admin / AI proxy. |
| `pnpm dev` | Both, in parallel. |
| `pnpm validate` | Runs the topic contract validator across `topics/**`. |
| `pnpm sync:skills` | Sync skill files from `.cursor/skills/` to `.claude/skills/` (single source of truth is Cursor). |
| `pnpm check:skills` | CI-friendly check that the two skill directories are identical. |

## Status

This repository is a foundation, not a finished product. See [ROADMAP.md](./ROADMAP.md). The contracts and skill are the load-bearing pieces and are intentionally completed first.

## License

MIT.
