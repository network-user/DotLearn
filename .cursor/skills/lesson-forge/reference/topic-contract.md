# Topic contract

Every topic under `topics/<slug>/` must satisfy this contract. The Zod schema in `packages/contracts/src/topic.schema.ts` is the executable source of truth; this document is the human-readable companion.

## Directory layout

```
topics/<slug>/
├── manifest.json                  required
├── README.md                      required, one-paragraph elevator pitch
├── theory/                        required, at least one file
│   ├── 01-<concept-id>.mdx
│   ├── 02-<concept-id>.mdx
│   └── ...
├── exercises/                     required, at least one file
│   ├── 01-<concept-id>.yaml
│   └── ...
├── flashcards/                    optional
│   └── deck.yaml
└── sandbox/                       optional, only when topic needs custom UI
    └── index.tsx
```

## manifest.json

```json
{
  "slug": "sql-fundamentals",
  "title": "SQL Fundamentals",
  "version": "1.0.0",
  "language": "en",
  "difficulty": "beginner",
  "estimatedHours": 6,
  "runtime": "sql.js",
  "prerequisites": [],
  "tags": ["databases", "sql"],
  "author": {
    "kind": "agent",
    "name": "cursor",
    "model": "claude-4.6-sonnet"
  },
  "concepts": [
    {
      "id": "select",
      "title": "SELECT and filtering",
      "estimatedMinutes": 45,
      "theoryFiles": ["theory/01-select.mdx"],
      "exerciseFiles": ["exercises/01-select.yaml"]
    }
  ],
  "license": "MIT"
}
```

### Field semantics

- **slug** — globally unique. Lowercase, ASCII, hyphenated, must match the folder name. No leading numbers.
- **title** — human-readable; appears in catalog and topic page header.
- **version** — semver. Bumped on any change to topic structure or exercise IDs.
- **language** — ISO 639-1; current player supports `en` and `ru`.
- **difficulty** — one of `beginner`, `intermediate`, `advanced`.
- **estimatedHours** — total wall-clock learner time. Sum of `concepts[].estimatedMinutes` should be within ±15% of this number × 60.
- **runtime** — one of the runtimes registered in `packages/sandbox/src/index.ts`. As of foundation: `sql.js`, `pyodide`, `javascript`, `none` (theory-only). Adding a runtime requires a coordinated change.
- **prerequisites** — array of other topic slugs whose mastery is required. Validated at load time: prereqs must exist.
- **tags** — short, lowercase, used for catalog filtering. Reuse existing tags when possible.
- **author** — `{ kind: "agent" | "human", name: string, model?: string }`. Required for traceability.
- **concepts** — ordered. Each concept binds a set of theory files to a set of exercise files. The `id` is referenced from exercise YAMLs via `concept` field.
- **license** — must be MIT or compatible OSS license. No proprietary content.

## Theory files

- MDX (`.mdx`), one file per concept (or split across multiple files for long concepts).
- Filename pattern: `<NN>-<concept-id>.mdx`.
- Must start with frontmatter:
  ```mdx
  ---
  conceptId: select
  title: SELECT statement
  estimatedMinutes: 15
  ---
  ```
- Code blocks use language fences (` ```sql `, ` ```python `, etc.) so the player can highlight syntax.
- Inline interactive widgets (callouts, embedded mini-exercises) are written as MDX components defined in `apps/web/src/mdx-components.tsx`. Use only components from that file.

## Exercise files

- YAML, validated against `packages/contracts/src/exercise.schema.ts`.
- Filename pattern: `<NN>-<concept-id>.yaml`. Multiple exercises per concept share one file with a top-level `exercises:` list.

See [exercise-types.md](./exercise-types.md) for the catalog of allowed `type` values and their per-type fields.

## Flashcards (optional)

```yaml
conceptId: select
cards:
  - id: select-001
    front: "What does SELECT * do?"
    back: "Returns all columns of every matching row."
    tags: [sql, basic]
```

The player uses FSRS 4.5 spaced repetition.

## Custom sandbox (rarely)

If a topic genuinely needs a UI that's not just "editor + output" (for example, a graph traversal visualizer), it provides `sandbox/index.tsx`. This file:

- Default-exports a React component
- Receives props typed via `packages/contracts/src/sandbox.schema.ts` (extend this contract when adding new sandbox kinds)
- Must not import anything from `apps/web/src/**` — the topic stays portable

Custom sandboxes are a contract extension. Surface them as a separate PR before introducing content that depends on them.
