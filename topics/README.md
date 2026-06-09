# Topics

Each topic lives in its own subdirectory and follows the contract documented in `.cursor/skills/lesson-forge/reference/topic-contract.md` (also mirrored at `.claude/skills/lesson-forge/reference/topic-contract.md`).

This directory is intentionally `gitignore`-friendly at the contents level — your fork can carry private topics without touching app code, since topics never import from `apps/*`.

Run `pnpm validate` from the repository root to validate every topic against the schema. The validator runs gold solutions through the sandbox and verifies the output matches `expected`.

To add a topic, ask Cursor or Claude Code in this repo:

> «Используй lesson-forge, добавь тему по <subject>»

The skill scaffolds the folder, generates content, validates, and opens a commit.
