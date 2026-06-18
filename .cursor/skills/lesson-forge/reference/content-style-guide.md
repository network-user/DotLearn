# Content style guide

The DotLearn voice is the voice of an experienced peer, not a textbook. Every theory file is a **longread article** in the spirit of Distill.pub: narrative prose, figures embedded in the text flow, and live code the reader can run and edit without leaving the page. Match these conventions across every topic.

## Tone

- **Direct.** "SELECT reads rows" not "SELECT is a statement that, when executed, has the effect of reading rows."
- **Honest about trade-offs.** When a feature has a footgun, name it the first time you teach it.
- **No hype.** Avoid "amazing", "powerful", "blazing fast". Adjectives should add information.
- **Second person, present tense.** "You write a WHERE clause", not "the user will then write".
- **Narrative, not bullet-dump.** A longread carries the reader through a story: a problem appears, a mental model resolves it, examples stress-test the model, edge cases refine it. Bullets are for genuinely enumerable facts only.

## Engagement and moderation (mandatory)

The material must be **interesting and easy to absorb**, not a dry reference dump. Treat these as hard requirements, not aspirations:

- **Moderate length.** Cover the concept fully, then stop. Respect the 1200-2000 word budget; if a concept honestly needs more, split it into two. Do not pad with restatement or throat-clearing.
- **No filler.** Cut any sentence that does not teach: no "as we all know", no marketing adjectives, no recap paragraphs that repeat the previous section. Density over volume.
- **Hook, not definition.** Open every concept with a concrete problem or a surprising fact the reader cares about (see the skeleton). Never open with a definition, a list, or a code block.
- **Earn attention with figures and live code.** Prefer an interactive or animated viz that *reveals* the mechanism (insert, collide, grow, remap) over a static figure that merely restates the prose. Pair it with a "change X and watch Y" invitation. This strengthens G10, it does not replace it.
- **Honest peer voice.** Name footguns the first time, show the one edge case that surprises, and tell a short bit of history where it illuminates - that is what makes a longread memorable instead of tedious.

A concept that is correct but boring fails review. Optimize for the reader who is curious but busy.

## Required article skeleton

Every theory file follows this narrative arc. Section headings are yours to write (make them concrete, not generic); the *order and presence* of these beats is mandatory.

```
---
conceptId: select
title: SELECT and filtering
estimatedMinutes: 45
---

# Title (concrete, can be a full sentence)

1. HOOK - one or two paragraphs: the problem this concept solves, what the reader
   will be able to do at the end. No definitions yet. The first paragraph gets a
   drop cap automatically, so open with prose, not a list or code block.

2. MENTAL MODEL - the core idea explained once, properly, WITH the concept's
   primary figure (Figure + illustration, chart, or a domain viz component).
   The figure is not decoration; the prose must reference it.

3. WORKED EXAMPLES - build incrementally. Each new construct introduces at most
   one new idea. Code blocks of at most ~10 lines between prose. Show the fixture
   when relevant.

4. LIVE SANDBOX MOMENT - at least one interactive block the reader is explicitly
   invited to modify: <SideSql editable live .../> for sql.js topics,
   <PyDemo .../> for pyodide topics. Pose a small "try changing X" challenge in
   the surrounding prose.

5. EDGE CASES - what happens with NULL / empty input / duplicates / inheritance
   diamonds / etc. At least one honest "this will surprise you" moment.

6. COMMON MISTAKES - the 2-4 most frequent beginner errors, each with the fix
   and ideally a one-line "why it happens".

7. DEEP DIVES (optional but encouraged) - <Detail summary="..."> blocks for
   material a curious reader wants and a hurried reader can skip (internals,
   performance, history).

8. <KeyTakeaways items={[...]} /> - 3-6 single-sentence takeaways.

9. REFERENCES - links to authoritative docs at the end of the file.
```

## Length budget

- Theory file: **1200-2000 words** in the primary language. Translations match structure and meaning, not word count.
- If a concept honestly needs more than 2000 words, split it into two concepts.
- Exercise prompt: **1-3 sentences**. If you need more, the exercise is doing too much.

## Figures and interactivity (mandatory)

- Every concept ships **at least one figure**: a `Figure`-wrapped illustration, a chart, or one of the domain viz components. See [mdx-components.md](./mdx-components.md) for the full catalog with props and copy-paste examples.
- Every concept whose topic runtime allows it (`sql.js`, `pyodide`) ships **at least one live sandbox moment** (`SideSql editable live`, `PyDemo`).
- Prefer the prebuilt parametric illustrations (`PipelineFigure`, `RowFilterFigure`, `SortLimitFigure`, `NestedQueryFigure`, `ObjectMemoryFigure`, `MroFigure`) and charts (`BarChart`, `LineChart`, `AreaChart`, `DistributionChart`); compose new ones from `Sketch` + `SketchBox/SketchArrow/SketchLabel` primitives only when no prebuilt fits.
- Figures get captions. Write captions that add information («Строки, не прошедшие WHERE, не доходят до SELECT»), not labels («Схема 1»).
- Use `MarginNote` for asides that would interrupt the narrative, `PullQuote` at most once per article, `Ref`/`Footnotes` for sourced claims woven into prose.

## Code examples

- Always runnable. Never `// TODO: complete this` in a theory file; that's an exercise.
- Show the **fixture** when relevant. Learners cannot reason about `SELECT * FROM users` without knowing what's in `users`.
- Prefer realistic over toy data. `users(id, name, age)` over `t(a, b, c)`.
- No comments inside fenced code blocks unless the comment itself teaches the point.

## Citations

When making a non-obvious claim, link to authoritative sources at the **end of the file**:

```
## References

- [PostgreSQL SELECT docs](https://www.postgresql.org/docs/current/sql-select.html)
```

Do not pretend to cite books or papers you have not read. If the claim is your own synthesis, present it as your own.

## Estimating minutes

`estimatedMinutes` for a concept = `ceil(words / 180)` reading time + ~5 min per live sandbox + ~3 min per figure the reader is expected to study + expected exercise time. Longread concepts typically land at **40-55 minutes**. The manifest's `estimatedHours` must be re-derived from the concept sum in the same change (the validator enforces the ±25% rule).

## Avoid

- Emojis in content (the project rule is no emojis unless requested)
- Memes, jokes that age poorly
- Cultural references that require context
- "We" instead of "you" — "we will now declare a function" reads as patronizing
- Inline comments in code blocks unless they teach a specific point ("this filter excludes nulls")
- Walls of consecutive figures or consecutive code blocks; alternate with prose
- Opening the article with a definition, a list, or a code block (the hook comes first)

## When generating in Russian

- Use «ёлочки» for quotes
- "Вы", not "ты", for the second person — keep a respectful peer tone
- Translate technical terms only when there is an established Russian translation; otherwise keep the English term (e.g. "merge", "rebase", "transaction" remain as-is in Russian content)
- Lowercase the first word after a colon (no English-style capitalization)
- Keep the Russian context in mind, lightly. The material is read in a Russian setting, so when an example needs a name, city, company, currency, or identifier, default to Russian realia: имена (Анна, Борис, Вера), города (Москва, Казань), сервисы (Яндекс, Сбер, Госуслуги, Ozon), рубли, ИНН/СНИЛС. This is a soft default for flavor and relatability, not a mandate - never contort a universal CS example to force "Russianness", and keep established English technical terms (hash, merge, shard, bucket) in English.
