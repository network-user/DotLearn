# Quality gates

These must all pass before a topic is committed. The validator (`pnpm validate`) enforces gates G1-G6 automatically (with the G6 caveat below). G7-G10 require human or LLM-judge review.

## G1 — Manifest valid

`manifest.json` validates against `manifest.schema.json`. No extra fields, no missing required fields. `estimatedHours` must be within ±25% of the sum of concept `estimatedMinutes` — when you change theory length, recompute both together.

## G2 — Slugs unique

No other topic uses the same `slug`. Concept `id`s are unique within the topic.

## G3 — Prerequisites resolve

Every `prerequisites[]` entry is a slug of an existing topic.

## G4 — Files referenced exist

Every `theoryFiles[]` and `exerciseFiles[]` entry points to a file that exists on disk and matches the language-suffixed pattern (`theory/<NN>-*.<lang>.mdx`, `exercises/<NN>-*.<lang>.yaml`). For every concept, each language listed in the manifest's `availableLanguages` must be represented by at least one theory file and one exercise file.

## G5 — Exercise schemas valid

Every exercise object validates against `exercise.schema.json` and uses only a `type` from the catalog. Exercises with `variants` must define the same variant count across all language files of the same exercise `id` (the validator enforces this parity).

## G6 — Gold solutions run and match

Every exercise's `solution` must produce exactly `expected`.

**What `pnpm validate` actually executes:** `sql-query` gold solutions (base and every variant) via sql.js in node, and `git-challenge` gold solutions (base and every variant) via the deterministic git engine in node — the engine replays each `solution` and asserts every `goal` holds. `javascript-function` solutions are **not** executed by the CLI validator — there is no JS sandbox in the node pipeline. For those:

1. Mentally trace each case against the solution while authoring.
2. Before commit, run each new or changed python/javascript gold solution with its cases once in the web sandbox (open the topic page and use the exercise runner, or a `PyDemo` scratch block).

Never claim G6 passes for python exercises on the strength of `pnpm validate` alone.

## G7 — Coverage

- Each concept has at least **3 exercises**.
- Each concept includes at least **one exercise at difficulty 1** (introductory) and **one at difficulty ≥3** (consolidation).
- Each topic includes at least **one difficulty 4-5 challenge**.
- Difficulty 1-2 exercises ship **≥2 variants** where the task can be parametrized (see exercise-types.md, Variants).
- Concept-to-theory mapping is balanced: no concept has theory but zero exercises, or vice versa.

## G8 — Editorial quality

Re-read every theory file and exercise prompt as a learner. Reject any of:

- Vague pronouns with no referent ("It does what you expect.")
- Unjustified claims ("This is the best way.")
- Authoritative tone without source ("Studies show...")
- Inconsistent terminology within the same topic
- Off-by-one or boundary errors in fixtures
- Exercise prompts that are ambiguous about what to return
- Hints that leak the solution or give syntax instead of mental model (see exercise-types.md, Hints quality bar)
- Content that breaks on narrow screens: oversized tables without a scrollable wrapper, code lines that cannot wrap or scroll, viz components with unconditional `min-w-*` (scope min-widths to a breakpoint, e.g. `sm:min-w-[160px]`). Theory must be readable on a 375px-wide phone.

## G9 — Difficulty calibration

Verify against [exercise-types.md](./exercise-types.md) difficulty rubric. Difficulty 1 must be doable in under a minute by someone who just read the theory. Difficulty 5 must require thinking, not just typing.

## G10 — Visual and interactive richness

Theory is a longread article, not a conspectus (see [content-style-guide.md](./content-style-guide.md)):

- Every concept has **at least one figure**: a `Figure`-wrapped illustration, a chart, or a domain viz component (catalog: [mdx-components.md](./mdx-components.md)).
- Every concept whose topic runtime is `sql.js` or `pyodide` has **at least one live sandbox moment** (`SideSql editable live` / `PyDemo`), with a "try changing this" invitation in the surrounding prose. Theory-only topics (`runtime: none`) are exempt.
- Figures carry informative captions; prose references its figures.
- Word count is within the 1200-2000 budget for the primary language.

## Common failure modes and fixes

| Failure | Likely cause | Fix |
|---|---|---|
| G6 fails on a `sql-query` because of column order | `ordered: true` is wrong, or solution doesn't ORDER BY | Either set `ordered: false` or add ORDER BY to gold solution |
| G6 fails on a `python-function` with float result | Used `expect:` for floats | Use `expect_approx:` |
| G5 fails — variant count differs between languages | Added a variant in one language only | Mirror the variant set in every language file |
| G7 fails — concept has only 2 exercises | Forgot to vary difficulty | Add at least one more, ideally at higher difficulty |
| G8 — prompt asks "return the answer" | Vague | Specify the shape: "return a list of dicts with keys id, name" |
| G9 — difficulty 1 is hard | Mislabelled | Re-rate; typically becomes difficulty 2 or 3 |
| G10 — concept has no figure | Theory written as plain conspectus | Add the concept's mental-model figure; prefer a prebuilt parametric illustration |

If you cannot fix a failure within two attempts, surface it to the user instead of papering over it.
