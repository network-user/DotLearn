# Content style guide

The DotLearn voice is the voice of an experienced peer, not a textbook. Match these conventions across every topic.

## Tone

- **Direct.** "SELECT reads rows" not "SELECT is a statement that, when executed, has the effect of reading rows."
- **Honest about trade-offs.** When a feature has a footgun, name it the first time you teach it.
- **No hype.** Avoid "amazing", "powerful", "blazing fast". Adjectives should add information.
- **Second person, present tense.** "You write a WHERE clause", not "the user will then write".

## Structure of a theory file

```
---
conceptId: select
title: SELECT and filtering
estimatedMinutes: 15
---

# SELECT and filtering

One-paragraph hook: what the learner will be able to do at the end and why it matters.

## The shape of SELECT

Concrete syntax example with annotation. No more than 5 lines of code at a time before prose.

## The shape with a filter

Build incrementally. Each new construct gets at most one new idea.

## When to use this

Real-world use case in 2–3 sentences.

## Common mistakes

Bullet list of the 2–3 most common errors a beginner makes, with the fix.

## Next

What the next concept builds on top of this. Single sentence.
```

## Length budget

- Theory file: **300–800 words**. If you exceed 800, split into two concept files.
- Exercise prompt: **1–3 sentences**. If you need more, the exercise is doing too much.

## Code examples

- Always runnable. Never `// TODO: complete this` in a theory file; that's an exercise.
- Show the **fixture** when relevant. Learners cannot reason about `SELECT * FROM users` without knowing what's in `users`.
- Prefer realistic over toy data. `users(id, name, age)` over `t(a, b, c)`.

## Citations

When making a non-obvious claim, link to authoritative sources at the **end of the file**:

```
## References

- [PostgreSQL SELECT docs](https://www.postgresql.org/docs/current/sql-select.html)
```

Do not pretend to cite books or papers you have not read. If the claim is your own synthesis, present it as your own.

## Avoid

- Emojis in content (the project rule is no emojis unless requested)
- Memes, jokes that age poorly
- Cultural references that require context
- "We" instead of "you" — "we will now declare a function" reads as patronizing
- Inline comments in code blocks unless they teach a specific point ("this filter excludes nulls")

## When generating in Russian

- Use «ёлочки» for quotes
- "Вы", not "ты", for the second person — keep a respectful peer tone
- Translate technical terms only when there is an established Russian translation; otherwise keep the English term (e.g. "merge", "rebase", "transaction" remain as-is in Russian content)
- Lowercase the first word after a colon (no English-style capitalization)
