# Quick Task 261116-cv2 — Code Review (quick depth)

**Base:** c2a0c9db..d496b4c2 · **Blockers:** 0 · **Warnings:** 5 · **Info:** 3 · Advisory only.

## Warnings
- **WR-01** CopyWorklogForm `started` = local-noon → toISOString → `+0000`; can shift the day at extreme UTC offsets. Inherited pattern from EditWorklogForm (not new).
- **WR-02** `mode === 'copy'` renders CopyWorklogForm without an `!isMine` guard (only reachable via the non-own button).
- **WR-03** If identity flips while in edit mode, row falls through to view but `onEditingChange(true)` is never reset → "Add entry" stays hidden until popover closes.
- **WR-04** `logAsMe` is true while `selectedUsername` is null during the initial load window; label falls back to "me".
- **WR-05** `isOwnWorklog` accepts a case-insensitive name match even when both keys are present and differ.

## Info
- **IN-01** CopyWorklogForm duplicates EditWorklogForm mutation/parse logic; `formatSecondsForInput` imported from a component.
- **IN-02** Copy form relies on parent `onMutationSuccess` for `['tempo','worklogs']` invalidation.
- **IN-03** `logAsMe` computed between `useState` declarations.
