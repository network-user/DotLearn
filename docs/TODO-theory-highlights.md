# Theory text highlights

**Status:** enabled (`THEORY_HIGHLIGHTS_ENABLED = true` in `apps/web/src/lib/feature-flags.ts`).

## What it does

Learners select text in theory MDX on TopicPage; a floating color toolbar saves the quote to IndexedDB (`highlights` table). Saved items appear on `/library` under the Highlights tab, with search, open-source, note editing, and delete.

## Implemented follow-ups (previously parked)

- [x] **In-article markup.** Saved highlights re-render inside the article as `<mark data-highlight-id>` elements. Anchoring is whitespace-tolerant (stored text matched with a `\s+`-tolerant pattern) and disambiguates duplicates via stored before/after context (`HighlightRecord.prefix` / `suffix`, captured at save time). If the text has shifted too far, the highlight is skipped silently; nothing breaks. A MutationObserver re-applies marks when lazy MDX chunks finish rendering.
- [x] **Clearer save feedback.** The save toast now carries an action button that opens `/library`.
- [x] **Notes on highlights.** `HighlightRecord.note` is editable from two places: clicking a mark in the article opens a popover (note textarea + color picker + delete), and the Library highlight card has an edit mode (pencil button).
- [x] **Color meaning.** Colors have shared meaning labels (yellow = key point, green = remember, blue = definition, pink = question; `topic:highlight.colors.*`). The Library Highlights tab shows a legend; the in-article picker, the mark popover, and the Library edit mode all use the same `HighlightColorPicker` component and `highlight-colors` definitions.
- [x] **Onboarding.** A one-time dismissible hint above the theory (`dotlearn:highlight-hint-seen` in localStorage, same pattern as `Onboarding.tsx`) tells users they can highlight text. Saving a first highlight also marks the hint as seen.

## Key files

| Area                                    | Path                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------- |
| Feature flag                            | `apps/web/src/lib/feature-flags.ts`                                             |
| Selection toolbar, marks, popover, hint | `apps/web/src/components/TheoryHighlighter.tsx`                                 |
| DOM anchoring                           | `apps/web/src/lib/highlight-anchor.ts` (+ `highlight-anchor.spec.ts`)           |
| Color definitions                       | `apps/web/src/lib/highlight-colors.ts`                                          |
| Shared picker                           | `apps/web/src/components/HighlightColorPicker.tsx`                              |
| Topic page mount                        | `apps/web/src/pages/TopicPage.tsx`                                              |
| Library tab                             | `apps/web/src/pages/LibraryPage.tsx` (legend, note editing, color change)       |
| Storage                                 | `apps/web/src/lib/progress-db.ts` (`HighlightRecord`, `addHighlight`, …)        |
| Hooks                                   | `apps/web/src/lib/use-learning.ts` (`useConceptHighlights`, `useAllHighlights`) |

## How to disable again

Set `THEORY_HIGHLIGHTS_ENABLED = false`. Storage, export/import (`progress-io`), and locale strings stay in place; only the UI (toolbar, marks, hint, Library tab) is gated.
