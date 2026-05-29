---
phase: 74-backlog-on-data-json
fixed_at: 2026-05-29T00:00:00Z
review_path: .planning/phases/74-backlog-on-data-json/74-REVIEW.md
iteration: 1
fix_scope: blocker + warning
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 74: Code Review Fix Report

**Fixed at:** 2026-05-29
**Source review:** `.planning/phases/74-backlog-on-data-json/74-REVIEW.md`
**Iteration:** 1
**Scope:** BLOCKER + WARNING (INFO findings deferred per --fix scope)

## Summary

- Findings in scope: 8 (2 BLOCKER + 6 WARNING)
- Fixed: 8
- Skipped: 0
- INFO findings (IN-01, IN-02, IN-03): out of scope, left unaddressed.

## Verification

- `npx tsc --noEmit`: clean after each fix and at end-of-run.
- `npx biome check <fixed files>`: clean (1 follow-up format/naming commit
  applied after WR-02 + WR-06 — `__partial` renamed to `isPartial` per
  `useNamingConvention` and the `useFieldMutation` signature reformatted
  per the line-width rule).
- `npx vitest run`: 1656 passed / 2 skipped / 18 todo across 147 files. No
  regressions.

## Fixed Issues

### BL-01: Issues in CLOSED sprints disappear from the backlog view

- **File:** `taskflow/src/routes/dashboard/BacklogPage.tsx`
- **Commit:** `c9a0cf19`
- **Applied fix:** Restricted the `issueIdToSprintId` reverse index to
  `ACTIVE`/`FUTURE` sprint states. Issues whose only sprint membership is a
  CLOSED sprint now fall through to `backlogIssuesAdapted` (the backlog
  bucket) instead of being filtered out by the "has fields.sprint?" guard.
  Matches the preferred fix from the review verbatim.
- **Verification class:** logic-bug — manual confirmation recommended that
  CLOSED-sprint carryover issues now appear under the Backlog section in a
  live env with a recently-closed sprint.

### BL-02: lookupSprintNameById returns null for CLOSED sprints

- **File:** `taskflow/src/routes/dashboard/BacklogPage.tsx`
- **Commit:** `ef4d6ac0`
- **Applied fix:** Resolve sprint names from `backlog.sprints` (the full
  envelope list, includes CLOSED) instead of the ACTIVE/FUTURE-filtered
  `sprintSections`. Added a `!backlog` guard for the no-data case. Matches
  the review's recommended fix.

### WR-01: Sidebar.prefetch.test.tsx is a helper-shape test, not a contract test

- **File:** `taskflow/src/components/app/__tests__/Sidebar.prefetch-helper-shape.test.tsx`
  (renamed from `Sidebar.prefetch.test.tsx`)
- **Commit:** `ea213cf3`
- **Applied fix:** Option (b) from the review — renamed the file, the
  describe block, and the local helper (`prefetchBacklogHelperShape`) to
  reflect that it pins down expected shape rather than gating the real
  Sidebar component. The docstring now explicitly names the limitation
  ("WILL NOT catch a Sidebar.tsx regression") and points to the static
  guard `scripts/check-legacy-backlog-keys.mjs` as the real gate for the
  legacy-key absence side. Option (a) (render real Sidebar) is recorded as
  deferred future work in the new docstring.

### WR-02: RecentItemsPopover cast partial GH objects to JiraIssue

- **File:** `taskflow/src/components/app/RecentItemsPopover.tsx`
- **Commits:** `17fa7921`, `06f0b9d2` (biome cleanup)
- **Applied fix:** Introduced `RecentIssueLike = JiraIssue | { key: string;
  fields: { summary: string }; isPartial: true }` discriminated union as
  the return type of `findJiraIssueInCache`. The `as JiraIssue` cast at
  the gh-backlog branch is replaced by returning the narrow `isPartial`
  variant. Existing call site `cached?.fields.summary` continues to work
  because both arms expose `fields.summary`. Future callers that touch
  any other field will be forced by TypeScript to check
  `'isPartial' in result` before access. Renamed `__partial` to
  `isPartial` for biome `useNamingConvention` compliance.
- **DIVERGENCE NOTE:** WR-02 also flagged `main.tsx:372-383`. On
  inspection that block does NOT cast to `JiraIssue` — it reads
  `match.summary` directly into `resolvedTitle` (the
  `getQueriesData<{ issues?: ... }>` generic is the narrow GH shape, no
  cast occurs). No edit applied to `main.tsx`. This is a partial
  divergence from the review; the underlying type-safety concern is
  already handled in that file.

### WR-03: Sidebar prefetch timer can be silently overwritten

- **File:** `taskflow/src/components/app/Sidebar.tsx`
- **Commit:** `6b5b67d4`
- **Applied fix:** `handleNavMouseEnter` now clears any prior
  `prefetchTimerRef.current` before scheduling a new debounce timer.
  Matches the review's recommended fix verbatim.

### WR-04: BacklogPage invalidates dead `['jira-sprint-stories']` key

- **File:** `taskflow/src/routes/dashboard/BacklogPage.tsx`
- **Commit:** `88f450f1`
- **Applied fix:** DIVERGENCE — On inspection,
  `['jira-sprint-stories']` is NOT dead: `RecentItemsPopover.tsx:46`
  reads it for the recents popover, and `main.tsx:~360` walks it in the
  title-resolution fallback chain. Per the review's
  "Either delete the dead invalidation lines, or add an explicit comment
  naming the legacy consumer" — I chose option (b) and added comments to
  both `confirmMoveToSprint` and `confirmMoveToBacklog` pointing to the
  live consumers. This preserves cross-surface freshness rather than
  trimming a still-active invalidation.

### WR-05: confirmMoveToSprint had unused `sprintName` param + `void sprintName;`

- **File:** `taskflow/src/routes/dashboard/BacklogPage.tsx`
- **Commit:** `88f450f1` (clustered with WR-04 — same function body)
- **Applied fix:** Removed `sprintName` from the function signature, the
  trailing `void sprintName;` no-op, and the call site
  (`ConfirmSprintMoveDialog.onConfirm`). The destination name is already
  displayed by the upstream dialog and is not needed by the
  `addIssuesToSprint` API call.

### WR-06: useFieldMutation invalidates ALL backlog boards on every edit

- **Files:**
  - `taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts`
  - `taskflow/src/routes/dashboard/issue-detail/IssueDetailSidebar.tsx`
- **Commits:** `7036925d`, `06f0b9d2` (biome signature formatting)
- **Applied fix:** Added an optional `boardId?: number | null` parameter
  to `useFieldMutation`. When provided, `onSettled` calls
  `invalidateGhBacklogData(queryClient, boardId)` to scope the
  invalidation to one board envelope; when null/undefined it falls back
  to the all-boards invalidation. Updated the call site in
  `IssueDetailSidebar.tsx` to resolve `boardId` via `useBoardId` (same
  pattern as `FieldsSection.tsx:149`) and pass it through. The PAT
  required by `useBoardId` is fetched via the existing `['jira-pat']`
  query (Infinity staleTime, same pattern as FieldsSection).

## Skipped Issues

None.

## Out-of-scope (INFO findings)

- **IN-01:** `Sidebar.tsx` prefetch catch swallows errors — left as-is.
- **IN-02:** `check-legacy-backlog-keys.mjs` double exclusion (`__tests__`
  + `*.test.*`) — left as-is.
- **IN-03:** `BacklogPage.tsx` empty-deps `useEffect` for stale-data
  banner reset — left as-is.

---

_Fixed: 2026-05-29_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
