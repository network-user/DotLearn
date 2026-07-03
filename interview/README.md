# Interview preparation content

Self-contained content for the **«Подготовка к собеседованиям»** section of the app
(route `/interview`). This directory is content, not code: it is loaded by
`apps/web/src/lib/interview.ts` and never imports from `apps/*`.

## Provenance

The question set was originally seeded from the public Python interview catalogue at
`speedrunit.ru/questions/python` and then **substantially reworked** into this project's
own material: a custom 10-section taxonomy, a different article format, rewritten
titles and prose, original interactive exercises, and added diagrams. The wording and
structure here are not a copy of the source; treat this as derived, adapted material.

## Layout

```
interview/
├── index.json              # question metadata (id, title, titleEn?, category, stage, exerciseCount, path)
├── exercises-index.json    # flat exercise metadata for the exam mode
├── flashcards-index.json   # prebuilt flashcard fronts/backs for /flashcards interview mode
└── <category>/
    ├── <id>.ru.mdx         # article (Russian, primary)
    ├── <id>.en.mdx         # article (English, optional)
    └── <id>.exercises.json # interactive exercises ({ "exercises": [...] }) validated by @dotlearn/contracts ExerciseFile
```

Categories: `python-core`, `data-structures`, `oop-patterns`, `concurrency`,
`data-storage`, `web-networking`, `frameworks`, `infrastructure`, `system-design`,
`quality-process`. Stages: `tech`, `system-design`, `hr`.

Article skeleton: `## Суть` → `## Что ответить на собесе` → `## Как это работает` →
`## Подводные камни`. Exercises reuse the standard exercise engine
(`theory-quiz`, `predict-output`, `fill-in-blanks`, `python-function`) and rely on
`variants` for randomization.

## Regenerating / maintaining

```bash
pnpm import:interview              # re-scrape source into interview/ (one-off seeding)
pnpm build:interview-index         # rebuild index.json + exercises-index.json from frontmatter/files
pnpm build:interview-flashcards    # rebuild flashcards-index.json from interview answer sections
pnpm reorg:interview               # move files into the category dir named in their frontmatter
pnpm validate:interview-exercises  # structural validation against the ExerciseFile schema
pnpm check:interview               # invariants: index <-> files, facets, duplicates
python scripts/verify-fix-interview.py  # execute python-function/predict-output and align expected values
```

After editing content, run `pnpm build:interview-index` so the indexes stay in sync.
