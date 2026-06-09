---
name: lesson-forge
description: Generate a new learning topic for DotLearn. Use whenever the user asks to add a topic, create lessons, generate exercises, or build a course. Produces a validated, standardized topic under topics/<slug>/.
triggers:
  - "add topic"
  - "create lesson"
  - "new topic"
  - "generate exercises"
  - "build a course"
  - "добавь тему"
  - "создай урок"
  - "новая тема"
  - "сгенерируй задания"
  - "lesson-forge"
files:
  - topics/**
---

# lesson-forge

Standardized pipeline for generating a new DotLearn topic. Every topic produced through this skill satisfies the same contract, renders in the same player, and merges cleanly into forks.

## When to activate

Activate when the user's intent is "build new learning material in this repo": adding a topic, expanding an existing topic with more lessons, or generating exercises for an existing concept.

Do **not** activate when:

- The user is asking conceptual questions about a topic (just answer normally).
- The user wants to modify the player (`apps/web`) or backend (`apps/api`) — that's a code change, not a content addition.
- The user is editing a single MDX or YAML file already on disk — that's an edit, not a new topic.

## Workflow — execute in this exact order

### 1. Parse intent

Extract:

- **Subject** (e.g. "SQL JOINs", "Python generators")
- **Depth** ("introduction", "deep dive", "beginner to intermediate")
- **Estimated hours** the learner should spend
- **Runtime** required (sql, python, javascript, theory-only)
- **Language** of the content (en or ru)

If anything critical is missing, ask the user **once** with a structured question. Do not proceed without these five fields.

### 2. Discover existing topics

Before generating anything:

- List `topics/*/manifest.json`
- Read each manifest's `slug`, `concepts[].id`, `prerequisites`
- Identify potential overlaps with the requested subject
- If significant overlap exists, surface it to the user and ask whether to extend the existing topic or create a new one

### 3. Plan curriculum

Produce a plan with this structure and **stop for user approval**:

```
Topic: <title> (slug: <slug>)
Runtime: <runtime>
Estimated: <hours>h, <difficulty>

Curriculum:
  1. <concept-id> — <title> (~<minutes> min, <N> exercises)
  2. ...

Prerequisites: [<other-topic-slug>, ...]
```

This is non-negotiable: never generate content before the user approves the plan. The cost of regenerating is high.

### 4. Scaffold the topic folder

From `.cursor/skills/lesson-forge/templates/topic/`:

```
topics/<slug>/
├── manifest.json
├── README.md
├── theory/
└── exercises/
```

Use the slug derived in step 1. Slug rules: lowercase, ASCII, hyphen-separated, no numbers at the start.

### 5. Generate the manifest first

The manifest is the **structural contract** of the topic. Write it before any lesson content. It must validate against `.cursor/skills/lesson-forge/schemas/manifest.schema.json`. After writing, immediately run schema validation. Do not proceed if it fails.

Required fields and their semantics are in [reference/topic-contract.md](./reference/topic-contract.md).

### 6. Generate theory then exercises, concept by concept

For each concept in the plan, in order:

1. Write `theory/<NN>-<concept-id>.mdx` following [reference/content-style-guide.md](./reference/content-style-guide.md).
2. Write `exercises/<NN>-<concept-id>.yaml`. Every exercise must:
   - validate against `exercise.schema.json`
   - have a `solution` field
   - have an `expected` field that the `solution` actually produces when executed
3. Mentally trace the solution against the fixture. If it would not match `expected`, fix the exercise before moving on.

Always finish one concept fully before starting the next. Do not interleave.

### 7. Validate

Read [reference/quality-gates.md](./reference/quality-gates.md) and verify each gate. If any gate fails, fix the offending file. Do not rationalize a failure away.

Run `pnpm validate` if available — the validator will execute every gold solution in the sandbox and compare to `expected`. Fix until it passes.

### 8. Self-review

Read [reference/quality-gates.md](./reference/quality-gates.md) — quality criteria section. Re-read each theory file and each exercise prompt as if you were the learner. Identify:

- Vague pronouns ("it does that")
- Unjustified claims
- Off-by-one or boundary issues in exercises
- Difficulty mislabelling

Fix what you find.

### 9. Commit

One commit per topic. Commit message format:

```
feat(topics): add <slug> — <short subject>

<N> concepts, <N> exercises, <runtime> runtime. Generated via lesson-forge.
```

If the topic introduces a new exercise `type` or a new runtime, that's a **breaking change to the contract**. Stop, surface this to the user, and propose extending `packages/contracts` and `packages/lesson-engine` in a separate PR first.

## Hard rules

1. **Never silently invent a new exercise type.** Only `type` values present in `schemas/exercise.schema.json` are valid.
2. **Never write to `apps/web` or `apps/api`.** Topic files only.
3. **Never skip the curriculum plan / approval step in section 3.**
4. **Never claim an exercise works without verifying the gold solution against `expected`.**
5. **No comments in code-style files.** Apply the project's no-comments rule to MDX code blocks too — comments allowed in MDX prose only.

## Reference documents

Load these on demand, not upfront:

- [reference/topic-contract.md](./reference/topic-contract.md) — full manifest specification
- [reference/exercise-types.md](./reference/exercise-types.md) — catalog of allowed exercise `type` values
- [reference/quality-gates.md](./reference/quality-gates.md) — what blocks merge
- [reference/content-style-guide.md](./reference/content-style-guide.md) — voice, depth, structure of theory

## Templates

Start each new topic from `templates/topic/` and each exercise from the appropriate template in `templates/`. Do not invent the structure from scratch.

## Mirror notice

This skill exists in two locations:

- `.cursor/skills/lesson-forge/` — Cursor activation
- `.claude/skills/lesson-forge/` — Claude Code activation

Both directories contain identical content. When editing, run `pnpm sync:skills` (or edit both manually) to keep them in sync. CI verifies they are identical.
