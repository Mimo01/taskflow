---
phase: quick-261028-lal
verified: 2026-10-28T00:00:00Z
status: human_needed
score: 5/5 must-haves verified (code level)
human_verification:
  - test: "Open a task in the peek panel on My Tasks, Sprint Board (card and story header), Backlog and Release detail"
    expected: "Matching row shows a subtle primary tint with a 2px left bar. TaskCard shows a tint and ring and keeps its type stripe. Closing or swapping the peek, or changing route, moves or clears the highlight."
    why_human: "Visual appearance. This includes the shadow bar painting on virtualized Backlog rows in WKWebView, and tint contrast against flagged or focused rows."
---

# Quick 261028-lal Verification

**Goal:** the task open in the peek sidebar is highlighted on the main page.
**Status:** human_needed. The code evidence supports every truth, but the visual result was not checked.

## Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Peeked task is highlighted on My Tasks, Sprint Board (cards and story headers), Backlog and Release detail | VERIFIED | `useIsPeeked` plus `data-peeked` plus the shared class are in MyTaskRow (parent and subtask roots), UnifiedTaskTable TaskRow, TaskCard (both root branches), StoryHeaderRow (both branches, keyed on `storyKey`) and BacklogRow (both branches via `rowClassName`). |
| 2 | Closing, swapping or a route change moves or clears the highlight | VERIFIED | main.tsx now reads `peekIssueKey` and `setPeekIssueKey` from `usePeekStore`. The close, swap (`onOpenIssue`) and route-change (`setPeekIssueKey(null)` in the pathname effect) call sites are unchanged, and the store drives the rows reactively. |
| 3 | Rows get a tint plus a 2px inset bar. TaskCard gets a tint plus a ring | VERIFIED | `src/lib/peek-highlight.ts` defines `PEEKED_ROW_CLASS = bg-primary/5 shadow-[inset_2px_0_0_var(--color-primary)]` and `PEEKED_CARD_CLASS = bg-primary/5 ring-2 ring-primary/40`. TaskCard uses the card class and the rows use the row class. |
| 4 | No layout shift | VERIFIED | The classes touch only background, box-shadow and ring. There is no border or padding change. BacklogRow's `isFocused` border classes are untouched. |
| 5 | DragOverlay clones are never highlighted | VERIFIED | TaskCard and BacklogRow both use `showPeek = isPeeked && !isOverlay`. TaskCard.test.tsx covers the overlay case. |

## Artifacts and wiring

- `peek.store.ts` exports `usePeekStore` and `useIsPeeked`, a boolean selector, and is not persisted.
- `peek-highlight.ts` exports both classes and is imported by all five components.
- main.tsx has two `usePeekStore(` selectors. The `useState` for the peek key is gone, and `setPeekIssueKey` was added to the effect deps.
- The only `usePeekStore.getState` calls are in `peek.store.test.ts`. There are none in render bodies, so the React Compiler stale-read pitfall does not apply.

## Spot-checks

- `npx vitest run` on peek.store, MyTaskRow, UnifiedTaskTable and TaskCard: 4 files, 119 tests passed.
- `npx tsc --noEmit -p .`: clean.
- I did not run biome or the full suite.

## Gaps

None. BacklogRow and StoryHeaderRow have no render tests. This was an accepted plan decision, and I confirmed their wiring by inspection.

## Anti-patterns

None found in the diffs: no TBD, FIXME or stub code.

## Human verification required

See the frontmatter. Check the visuals on the five surfaces. In particular, check that the Backlog inset shadow paints on virtualized absolute rows in the Tauri WKWebView.
