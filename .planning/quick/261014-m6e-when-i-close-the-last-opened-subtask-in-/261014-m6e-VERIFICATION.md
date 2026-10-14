---
phase: quick-261014-m6e
verified: 2026-10-14T16:20:00Z
status: human_needed
score: 6/6 must-haves verified
---

# Quick 261014-m6e Verification

**Goal:** Closing the last open subtask of a story (moving it to done) pops up a modal asking whether to also move the story to done.

## Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Last open subtask moved to done (board or sidebar) opens the modal | VERIFIED | `SprintBoardTab.tsx:1395-1402` calls `parentPrompt.check` inside the `try`, after the invalidations. `FieldsSection.tsx` `onSuccess` calls `check` with `fromCategory`/`toCategory` from the mutation vars. All board paths (drag, context menu, resolution confirm) reach `handleTransition` with `toStatusCategoryKey` (lines 1240-1293). `StatusPopover` forwards the category as the 4th arg on both the plain and resolution-confirm paths. |
| 2 | No modal for a non-subtask, a non-done target, done->done, a done parent, or an open sibling | VERIFIED | The hook gate at `CompleteParentDialog.tsx:63` covers the first three. `parentCompletion.ts:58` handles a done parent, and `:86-88` handles open siblings. It uses a fresh `apiFetch` read, not the cache. Siblings with no category fall back to a JQL search. Any error returns `shouldPrompt: false`. |
| 3 | "Move story" always lists the parent's done transitions, and a resolution goes through the resolution picker | VERIFIED | The pick step uses `fetchQuery` with `transitionsWithFieldsKey`, filtered to `statusCategory 'done'`, so a single entry still shows. `resolveDropResolution` branches to plain, dialog or block. `BoardResolutionDialog` renders only while the main dialog is closed. `postTransition` is called with `{ resolution }`. |
| 4 | "Not now" or dismiss makes no POST | VERIFIED | `handleOpenChange` and `DialogClose` only call `onClose`. The POST happens only in `runTransition`, which is reached from a pick. |
| 5 | A failed parent transition shows an inline error, and a failed subtask transition never prompts | VERIFIED | `runTransition` catch sets `role="alert"` text and returns to the pick step. On the board the check is not in the catch. In the sidebar it is in `onSuccess`. |
| 6 | Caches refresh after the story moves | VERIFIED | `invalidateAfterTransition` is called on success. It covers the issue-detail, changelog, transitions-fields, parent-detail, subtask-enrichment, epic-stories, GH all-data/backlog, epics-basic, fixversion-issues, version-counts and issues keys. |

## Artifacts and Checks

- Created `parentCompletion.ts` and `CompleteParentDialog.tsx`, plus a test file for each. Both are substantive.
- `useParentCompletionPrompt` is imported and rendered (`{parentPrompt.dialog}`) in `SprintBoardTab` and `FieldsSection`.
- `transitions.ts` is unchanged since the pre-dispatch commit.
- Ran the 5 relevant suites: 99/99 tests passed. `tsc --noEmit` is clean.
- No TBD, FIXME or XXX markers in the new files.
- Behavioral note: `invalidateAfterTransition` takes `boardId?: number | null`, which differs from the plan's loose typing. This compiles and is fine.

## Human Verification Required

1. **Board flow.** On a story with 2 subtasks, close the first. Expected: no prompt. Close the second by drag or context menu. Expected: the "All subtasks of KEY are done" modal appears. Pick a done status, and expect the resolution picker if one is required. The story card should move to Done.
   - Why human: real Jira statusCategory data on embedded subtasks (assumption A1) and the Base UI dialog sequencing can't be checked by grep.
2. **Sidebar flow.** Repeat the check from the issue-detail status popover. Also check that "Not now" leaves the story untouched.

## Gaps

None found in the code.
