---
phase: quick-260531-2el
plan: 01
subsystem: sprint-board / filters
tags: [jira, greenhopper, quick-filters, cleanup, revert]
requires:
  - SprintBoardTab (label/epic/assignee/status filters + UnifiedFilterBar saved presets)
provides:
  - Label-only QuickFilterChipRow (no Jira editmodel quick-filter chips)
affects:
  - taskflow/src/services/jira/types.ts
  - taskflow/src/stores/filter.store.ts
  - taskflow/src/routes/dashboard/QuickFilterChipRow.tsx
  - taskflow/src/routes/dashboard/SprintBoardTab.tsx
tech-stack:
  removed:
    - GreenHopper editmodel quick-filter fetcher (board-config.ts)
    - client-side JQL evaluator for board quick filters
key-files:
  created: []
  modified:
    - taskflow/src/services/jira/types.ts
    - taskflow/src/stores/filter.store.ts
    - taskflow/src/routes/dashboard/QuickFilterChipRow.tsx
    - taskflow/src/routes/dashboard/QuickFilterChipRow.test.tsx
    - taskflow/src/routes/dashboard/SprintBoardTab.tsx
    - taskflow/src/routes/dashboard/SprintBoardTab.test.tsx
  deleted:
    - taskflow/src/services/jira/board-config.ts
    - taskflow/src/services/jira/board-config.test.ts
decisions:
  - Deleted useQuickFilteredIssues entirely (no production consumer) rather than simplifying it.
  - Left the pre-existing WR-06 useExhaustiveDependencies warning on the setBannerDismissed effect untouched (out of scope, present at HEAD).
metrics:
  duration: ~10m
  tasks: 3
  files_changed: 8
  completed: 2026-05-31
---

# Quick Task 260531-2el: Remove Jira-loaded Sprint Board quick filters Summary

Surgically reverted commit 79efbb39 — the Sprint Board no longer fetches or
renders Jira GreenHopper editmodel quick-filter chips. The app's own filters
(label chips, epic/label/assignee/status, UnifiedFilterBar saved presets) remain
fully functional.

## What Changed

**Task 1 — Delete editmodel fetcher + type** (`46c95ae1`)
- `git rm` of `board-config.ts` and `board-config.test.ts` (sole-purpose files,
  only production consumer was SprintBoardTab).
- Removed the `JiraBoardQuickFilter` interface (and its Phase 33 comment) from
  `jira/types.ts`. Surrounding `ParsedDuration` / `JiraSavedFilter` untouched.

**Task 2 — Strip Jira-QF state + JQL** (`35798b89`)
- `filter.store.ts`: removed `activeJiraQuickFilters` field/initializer/clearAll
  entry, `toggleJiraQuickFilter`, and `clearJiraQuickFilters`. Kept
  `activeLabelFilters` / `toggleLabelFilter` / `clearLabelFilters`, the
  `QuickFilter` saved-preset type, `applyQuickFilter`, and all
  epic/label/assignee/status members.
- `QuickFilterChipRow.tsx`: rewritten as a label-only chip row. Removed the
  `JiraBoardQuickFilter` import, JQL helpers (`parseSimpleJql`,
  `evaluateCondition`, `evaluateQuickFilter`), and the unused
  `useQuickFilteredIssues` hook. Props reduced to `{ labels: string[] }`. Label
  chips are now the first/focusable chips (`tabIndex` re-indexed to `j`); guard is
  `if (labels.length === 0) return null;`. Top doc-comment updated.
- `QuickFilterChipRow.test.tsx`: removed the two Jira-QF `it.todo` stubs; kept the
  label + a11y todos.

**Task 3 — Remove SprintBoardTab wiring + verify** (`e1c098f0`)
- Removed the `fetchBoardQuickFilters` import, the `boardQuickFilters` useQuery
  (`['jira-board-quickfilters', boardId]`) and its invalidation block,
  `activeJiraQuickFilters` from the store destructure, the `qfMatch` block (and
  its term in the `applyFilters` return), the local `parseSimpleJql` /
  `evaluateQfCondition` helpers, and the `activeJiraQuickFilters.size > 0` term
  in the local-filters guard.
- `<QuickFilterChipRow>` now renders as `<QuickFilterChipRow labels={filterOptions.labels} />`
  (dropped `quickFilters` and `issues` props).
- Updated stale R-01 doc-comments and the test's board-config mock + the
  `jira-board-quickfilters` invalidation assertion.

## Verification

- Repo-wide grep across `src/**/*.{ts,tsx}` for `activeJiraQuickFilters`,
  `fetchBoardQuickFilters`, `JiraBoardQuickFilter`, `jira-board-quickfilters`,
  `evaluateQfCondition`, `toggleJiraQuickFilter`, `clearJiraQuickFilters`,
  `useQuickFilteredIssues`, `board-config`: **0 matches**.
- `tsc --noEmit`: my 6 touched files are type-clean (0 errors). Pre-existing
  errors remain only in the untouched `ActivityTimeline.test.tsx` (out of scope).
- `npm test` (vitest run): **1675 passed, 2 skipped, 13 todo, 0 failures**
  (151 test files passed).
- Biome on the 6 touched files: clean except one pre-existing FIXABLE warning
  (see Deferred Issues).
- `board-config.ts` / `board-config.test.ts` no longer exist.
- KEPT and confirmed present: `QuickFilterChipRow` component + render,
  `toggleLabelFilter`/`clearLabelFilters`, the `QuickFilter` saved-preset type,
  epic/label/assignee/status filtering, `settings.store.test.ts` untouched,
  `filter.store.test.ts` untouched.

## Deviations from Plan

**[Rule 3 - Blocking] Biome formatter applied to SprintBoardTab.tsx**
- After removing the QuickFilterChipRow props, Biome flagged a `format` issue on
  `SprintBoardTab.tsx`. Ran `biome check --write` on the touched files only; the
  safe formatter reflowed the affected lines. No behavior change.

## Deferred Issues

The task constraint cited a "Biome baseline 0 errors / 0 warnings", but the
working tree at HEAD already carried pre-existing Biome/tsc issues in files
**unrelated** to this task (e.g. `ActivityTimeline.test.tsx`,
`adapter-backlog.test.ts`, `IssueDetailPage.tsx`, `transitions.ts`,
`useGhAllData.ts`, `useGhBacklogData.ts`, `CommentComposer.test.tsx`). Per the
executor SCOPE BOUNDARY, these were left untouched — they are not caused by the
Jira-QF removal. As a result `npm run check` (`biome check && tsc`) does not pass
0/0, but this state pre-existed this task and none of it stems from my changes.

One pre-existing warning sits inside a file I did touch:
- `SprintBoardTab.tsx:712` `lint/correctness/useExhaustiveDependencies` on the
  WR-06 `useEffect(() => setBannerDismissed(false), [boardId])`. Verified present
  at HEAD (line 723 before my edits) via `git show HEAD:...`. The `boardId`
  dependency is intentional (WR-06: reset the dismissed banner when the board
  changes) — Biome's exhaustive-deps cannot see that intent. Left as-is to avoid
  changing documented behavior and because it is out of scope for this task.

## Known Stubs

None.

## Self-Check: PASSED

- Deleted files confirmed absent: `board-config.ts`, `board-config.test.ts`.
- Commits confirmed in `git log`:
  - `46c95ae1` feat(quick-260531-2el): delete editmodel quick-filter fetcher and JiraBoardQuickFilter type
  - `35798b89` refactor(quick-260531-2el): strip Jira-QF state and JQL from filter store and chip row
  - `e1c098f0` refactor(quick-260531-2el): remove all Jira-QF wiring from SprintBoardTab
