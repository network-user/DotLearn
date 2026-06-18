# Topic contract

Every topic under `topics/<slug>/` must satisfy this contract. The Zod schema in `packages/contracts/src/topic.schema.ts` is the executable source of truth; this document is the human-readable companion.

## Directory layout

```
topics/<slug>/
├── manifest.json                  required
├── README.md                      required, one-paragraph elevator pitch
├── theory/                        required, at least one file per available language
│   ├── 01-<concept-id>.<lang>.mdx
│   ├── 02-<concept-id>.<lang>.mdx
│   └── ...
├── exercises/                     required, at least one file per available language
│   ├── 01-<concept-id>.<lang>.yaml
│   └── ...
├── flashcards/                    optional
│   └── deck.yaml
└── sandbox/                       optional, only when topic needs custom UI
    └── index.tsx
```

`<lang>` is `en` or `ru`. Every theory and exercise file declares its language in the filename suffix. A multilingual topic provides parallel sets (e.g., both `01-select.en.mdx` and `01-select.ru.mdx`).

## manifest.json

```json
{
  "slug": "sql-fundamentals",
  "title": "SQL Fundamentals",
  "version": "1.0.0",
  "availableLanguages": ["en", "ru"],
  "primaryLanguage": "en",
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
      "theoryFiles": ["theory/01-select.en.mdx", "theory/01-select.ru.mdx"],
      "exerciseFiles": ["exercises/01-select.en.yaml", "exercises/01-select.ru.yaml"]
    }
  ],
  "license": "MIT"
}
```

### Field semantics

- **slug** — globally unique. Lowercase, ASCII, hyphenated, must match the folder name. No leading numbers.
- **title** — human-readable; appears in catalog and topic page header.
- **version** — semver. Bumped on any change to topic structure or exercise IDs.
- **availableLanguages** — non-empty, deduplicated array of languages this topic ships with. Supported values: `en`, `ru`. Every language listed here must have matching `.<lang>.mdx` and `.<lang>.yaml` files in every concept.
- **primaryLanguage** — the original language of the content. Used as fallback when the learner's UI language isn't in `availableLanguages`. Must appear in `availableLanguages`.
- **difficulty** — one of `beginner`, `intermediate`, `advanced`.
- **estimatedHours** — total wall-clock learner time. Sum of `concepts[].estimatedMinutes` should be within ±15% of this number × 60.
- **runtime** — one of the runtimes registered in `packages/sandbox/src/index.ts`. As of foundation: `sql.js`, `pyodide`, `javascript`, `none` (theory-only). Adding a runtime requires a coordinated change.
- **prerequisites** — array of other topic slugs whose mastery is required. Validated at load time: prereqs must exist.
- **tags** — short, lowercase, used for catalog filtering. Reuse existing tags when possible.
- **author** — `{ kind: "agent" | "human", name: string, model?: string }`. Required for traceability.
- **concepts** — ordered. Each concept binds a set of theory files to a set of exercise files. The `id` is referenced from exercise YAMLs via `concept` field. For every language in `availableLanguages` there must be at least one matching theory file and at least one matching exercise file inside each concept.
- **license** — must be MIT or compatible OSS license. No proprietary content.

## Theory files

- MDX (`.mdx`), one file per concept per language (or split across multiple files for long concepts).
- Filename pattern: `<NN>-<concept-id>.<lang>.mdx` where `<lang>` is `en` or `ru`.
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
- Filename pattern: `<NN>-<concept-id>.<lang>.yaml`. Multiple exercises per concept share one file with a top-level `exercises:` list.
- Exercise `id` values must be unique across all language variants of a concept; reuse the same id for the same exercise translated.

See [exercise-types.md](./exercise-types.md) for the catalog of allowed `type` values and their per-type fields.

## Flashcards (optional)

```yaml
conceptId: select
cards:
  - id: select-001
    front: 'What does SELECT * do?'
    back: 'Returns all columns of every matching row.'
    tags: [sql, basic]
```

The player uses FSRS 4.5 spaced repetition.

## Custom sandbox (rarely)

If a topic genuinely needs a UI that's not just "editor + output" (for example, a graph traversal visualizer), it provides `sandbox/index.tsx`. This file:

- Default-exports a React component
- Receives props typed via `packages/contracts/src/sandbox.schema.ts` (extend this contract when adding new sandbox kinds)
- Must not import anything from `apps/web/src/**` — the topic stays portable

Custom sandboxes are a contract extension. Surface them as a separate PR before introducing content that depends on them.
