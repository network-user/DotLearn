# TODO: Theory text highlights (parked)

**Status:** UI disabled (`THEORY_HIGHLIGHTS_ENABLED = false` in `apps/web/src/lib/feature-flags.ts`).

## What it does

Learners select text in theory MDX on TopicPage; a floating color toolbar saves the quote to IndexedDB (`highlights` table). Saved items appear on `/library` under the Highlights tab, with search, open-source, and delete.

## How to re-enable

1. Set `THEORY_HIGHLIGHTS_ENABLED = true` in `apps/web/src/lib/feature-flags.ts`.
2. Verify: select text in a concept theory → color dots appear → save → entry shows on `/library` → Highlights tab.

Backend code is unchanged: `TheoryHighlighter.tsx`, `progress-db` highlight APIs, `progress-io` export/import, and locale strings stay in the repo.

## Follow-up work (why it was parked)

The feature works but UX is unclear without these improvements:

- [ ] **In-article markup**: re-show saved highlights in theory text (`useConceptHighlights` exists but is unused).
- [ ] **Clearer save feedback.** Toast should mention Library or link to `/library`, not only "Saved to library".
- [ ] **Notes on highlights**: `HighlightRecord.note` and `setHighlightNote` exist; add UI to attach/edit a note.
- [ ] **Onboarding** - short hint on first selection or in reading settings.
- [ ] **Color meaning** (optional legend or labels so colors are not arbitrary dots).

## Key files

| Area              | Path                                                                            |
| ----------------- | ------------------------------------------------------------------------------- |
| Feature flag      | `apps/web/src/lib/feature-flags.ts`                                             |
| Selection toolbar | `apps/web/src/components/TheoryHighlighter.tsx`                                 |
| Topic page mount  | `apps/web/src/pages/TopicPage.tsx`                                              |
| Library tab       | `apps/web/src/pages/LibraryPage.tsx`                                            |
| Storage           | `apps/web/src/lib/progress-db.ts` (`HighlightRecord`, `addHighlight`, …)        |
| Hooks             | `apps/web/src/lib/use-learning.ts` (`useConceptHighlights`, `useAllHighlights`) |
