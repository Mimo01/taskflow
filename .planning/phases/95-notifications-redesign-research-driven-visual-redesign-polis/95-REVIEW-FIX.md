---
phase: 95-notifications-redesign-research-driven-visual-redesign-polis
fixed_at: 2026-11-11T08:45:00Z
review_path: .planning/phases/95-notifications-redesign-research-driven-visual-redesign-polis/95-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: complete
---

# Phase 95: Code Review Fix Report

**Scope:** CR-01, CR-02, CR-03, WR-01, WR-02, WR-03 and WR-04. WR-05, WR-06 and IN-01 to IN-03 are out of scope and will be filed as todos.

Every finding was checked against the code first. Each fix has a regression test, and each test failed before its fix was applied. All commits passed the pre-commit hook (biome, tsc and the full vitest suite). The approved visual design and wording did not change.

## Fixed Issues

| ID | Commit | Fix |
|----|--------|-----|
| CR-01 | 4038b8d6 | The service drops `jira-allcomment-X` when `jira-comment-X` is in the same batch. `buildEntries` also collapses pairs that were already persisted: the mention copy wins, the comment counts as read if either copy is read, and read/Done act on both ids through the new `entryIds()` helper (`EventEntry.duplicateIds`). |
| CR-02 | 63147feb | `signedTextMode` and `labelTokens` split on `[ \t\n,]+`, and `stripSigns` splits on `/ +/`. U+00A0 inside a label now stays part of the label. |
| CR-03 | b0b5f0a1 | `mergeChanges` collapses first-from → last-to only for a real chain (the next `from` equals the previous `to`). Otherwise it keeps a separate line, so Fix Version, Component and GitLab assignees keep every value. |
| WR-01 | c6b64d55 | Change lines (system notes and issue updates) are parsed from `fullBody` whenever it extends `bodyPreview`. This uses the same `startsWith` rule as `commentPreview`. |
| WR-02 | c4fa5590 | `useUnreadCardCount` uses `useNow(60_000)` and includes it in the memo deps. |
| WR-03 | 21e6ce48 | `u` sets `pendingFocus` before `onToggleRead`, the same way `e`/Delete does. |
| WR-04 | b5eae1f4 | The pulse cleanup clears both the timer and the pulse. The baseline count tracks every change. No pulse fires until persist has hydrated, and `onFinishHydration` sets the baseline. This also fixed a store `merge` crash when storage is empty: hydration never finished on first launch. |

## Notes for human verification

- **CR-03 and WR-01 change logic.** Mark them "fixed: requires human verification" and check them in the app.
- **CR-03, non-chain lines:** a merged card with two separate fix-version additions now lists two lines and reads "updated 2 fields". This is the same presentation already used for a single Jira history with two version items.
- **WR-01, fallback rule:** `fullBody` is used only when it starts with `bodyPreview`. Real service data always meets this. Test fixtures with an unrelated `fullBody` keep their old behaviour.
- **WR-03, mouse path not changed:** clicking the "Mark as read" tray button in Unread view still drops focus. The fix covers only the keyboard path the finding cites.

---

_Fixed: 2026-11-11_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
