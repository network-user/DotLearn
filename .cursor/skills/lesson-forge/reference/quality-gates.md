# Quality gates

These must all pass before a topic is committed. The validator (`pnpm validate`) enforces gates G1–G6 automatically. G7–G9 require human or LLM-judge review.

## G1 — Manifest valid

`manifest.json` validates against `manifest.schema.json`. No extra fields, no missing required fields.

## G2 — Slugs unique

No other topic uses the same `slug`. Concept `id`s are unique within the topic.

## G3 — Prerequisites resolve

Every `prerequisites[]` entry is a slug of an existing topic.

## G4 — Files referenced exist

Every `theoryFiles[]` and `exerciseFiles[]` entry points to a file that exists on disk and has the right extension.

## G5 — Exercise schemas valid

Every exercise object validates against `exercise.schema.json` and uses only a `type` from the catalog.

## G6 — Gold solutions run and match

Every exercise's `solution` is executed in the sandbox (`sql.js`, `pyodide`, etc. — same runtime the manifest declares). The output must equal `expected`. This is the strongest content-quality gate and prevents AI hallucination of broken examples.

## G7 — Coverage

- Each concept has at least **3 exercises**.
- Each concept includes at least **one exercise at difficulty 1** (introductory) and **one at difficulty ≥3** (consolidation).
- Concept-to-theory mapping is balanced: no concept has theory but zero exercises, or vice versa.

## G8 — Editorial quality

Re-read every theory file and exercise prompt as a learner. Reject any of:

- Vague pronouns with no referent ("It does what you expect.")
- Unjustified claims ("This is the best way.")
- Authoritative tone without source ("Studies show...")
- Inconsistent terminology within the same topic
- Off-by-one or boundary errors in fixtures
- Exercise prompts that are ambiguous about what to return

## G9 — Difficulty calibration

Verify against [exercise-types.md](./exercise-types.md) difficulty rubric. Difficulty 1 must be doable in under a minute by someone who just read the theory. Difficulty 5 must require thinking, not just typing.

## Common failure modes and fixes

| Failure | Likely cause | Fix |
|---|---|---|
| G6 fails on a `sql-query` because of column order | `ordered: true` is wrong, or solution doesn't ORDER BY | Either set `ordered: false` or add ORDER BY to gold solution |
| G6 fails on a `python-function` with float result | Used `expect:` for floats | Use `expect_approx:` |
| G7 fails — concept has only 2 exercises | Forgot to vary difficulty | Add at least one more, ideally at higher difficulty |
| G8 — prompt asks "return the answer" | Vague | Specify the shape: "return a list of dicts with keys id, name" |
| G9 — difficulty 1 is hard | Mislabelled | Re-rate; typically becomes difficulty 2 or 3 |

If you cannot fix a failure within two attempts, surface it to the user instead of papering over it.
