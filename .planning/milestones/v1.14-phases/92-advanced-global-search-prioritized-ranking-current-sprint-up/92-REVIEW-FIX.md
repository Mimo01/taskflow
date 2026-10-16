---
phase: 92-advanced-global-search-prioritized-ranking-current-sprint-up
fixed_at: 2026-10-16T15:31:17Z
review_path: .planning/milestones/v1.14-phases/92-advanced-global-search-prioritized-ranking-current-sprint-up/92-REVIEW.md
iteration: 1
findings_in_scope: 11
fixed: 11
skipped: 0
status: all_fixed
---

# Phase 92: Code Review Fix Report

**Fixed at:** 2026-10-16T15:31:17Z
**Source review:** .planning/milestones/v1.14-phases/92-advanced-global-search-prioritized-ranking-current-sprint-up/92-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 11 (2 critical, 9 warning; Info excluded by scope)
- Fixed: 11 (CR-01, CR-02 and WR-01 were already fixed in c4331191; 8 new commits)
- Skipped: 0

Every new fix comes with a regression test, and each test was confirmed to fail before its fix. For WR-06 the pre-fix check was done by temporarily restoring the HEAD version of the hook files. Each commit went through the full pre-commit gate (biome, tsc, full vitest suite: 3746 passed at the last commit).

## Fixed Issues

### CR-01: Body-search sanitiser joins the pieces of hyphenated, slashed or @ terms

**Files modified:** `taskflow/src/services/jira.ts`, `taskflow/src/services/jira.test.ts`
**Commit:** c4331191 (already fixed before this run; checked with `git show`)
**Applied fix:** Reserved characters are now turned into whitespace before splitting into tokens, so `sign-in` becomes `sign` + `in*`. Tests cover sign-in, api/v2 and email input.

### CR-02: Removing the Direct-match row after grouping orphans its subtasks

**Files modified:** `taskflow/src/lib/global-search.ts`, `taskflow/src/lib/global-search.test.ts`, `taskflow/src/components/app/CommandPalette.tsx`
**Commit:** c4331191 (already fixed before this run)
**Applied fix:** `withoutDirectMatch` keeps a direct-match parent that heads indented subtasks as a dimmed context row. A direct match with no subtasks is still removed.

### WR-01: Uppercase boolean words in the query break the whole body search

**Files modified:** `taskflow/src/services/jira.ts`, `taskflow/src/services/jira.test.ts`
**Commit:** c4331191 (already fixed before this run)
**Applied fix:** `buildBodySearchJql` drops bare `AND`/`OR`/`NOT` tokens, and a test covers this. Lower-case `and`/`or` are not Lucene operators, so they are left alone on purpose.

### WR-02: `isKeyLikeQuery` rejects valid Jira keys that contain digits or underscores

**Files modified:** `taskflow/src/lib/global-search.ts`, `taskflow/src/lib/global-search.test.ts`
**Commit:** f31af600
**Applied fix:** The regex is now `/^[A-Za-z][A-Za-z0-9_]*-\d+$/` and the redundant `/i` is gone. Tests cover `ab2-12`, `MY_PROJ-3`, `2AB-12` (rejected) and `sign-in` (rejected).

### WR-03: Failed closed-issues search is silent

**Files modified:** `taskflow/src/components/app/CommandPalette.tsx`, `taskflow/src/components/app/CommandPalette.test.tsx`
**Commit:** 62d42b2d
**Applied fix:** When `includeClosed && closedQuery.isError`, the palette shows "Couldn't search closed issues." and suppresses the "No results found" empty state.

### WR-04: `isDefaultState` uses the untrimmed query

**Files modified:** `taskflow/src/components/app/CommandPalette.tsx`, `taskflow/src/components/app/CommandPalette.test.tsx`
**Commit:** 98dd298b
**Applied fix:** Changed to `isDefaultState = trimmed.length < 2`. With `"c "` or blank input the palette now stays in Recent Items.

### WR-05: Stale title highlight ranges when a Jira hit replaces the local entry

**Files modified:** `taskflow/src/lib/global-search.ts`, `taskflow/src/lib/global-search.test.ts`
**Commit:** 3ffe1462
**Applied fix:** In `consider()`, if the kept hit is a title hit and the Jira summary differs from the indexed one, the title is matched again against the fresh summary to get new ranges. If the fresh title no longer matches, the Jira body hit (desc/comment tag and snippet) is used instead.
**Status:** fixed: requires human verification (this is ranking logic; the fallback to the body hit when the fresh title no longer matches was my own design choice)

### WR-06: Recent-issues fetch can send the previous instance's PAT

**Files modified:** `taskflow/src/hooks/useRecentIssues.ts`, `taskflow/src/hooks/useRecentIssues.test.tsx` (new), `taskflow/src/hooks/useGlobalSearchSources.ts`, `taskflow/src/hooks/useGlobalSearchSources.test.tsx`, `taskflow/src/services/jira/greenhopper/useGhBacklogData.ts`
**Commit:** 818993ae
**Applied fix:**
- `useRecentIssues` now reads the PAT inside `queryFn` and no longer keeps token state. `isLoading` is `wanted && isPending`, so a missing PAT errors out instead of loading forever.
- `useGlobalSearchSources` and `useGhBacklogData` now record which `jiraBaseUrl` a token was read for, and treat the token as `null` until that matches the current URL. The stale biome-ignore suppressions were removed, because the effect now reads `jiraBaseUrl`.
- I created a new test file, `useRecentIssues.test.tsx`, for the regression test.
**Status:** fixed: requires human verification (this changes token/loading state; `useGhBacklogData` is also used by BacklogPage)

### WR-07: Recent-item parent info can never be cleared

**Files modified:** `taskflow/src/stores/recent-items.store.ts`, `taskflow/src/stores/recent-items.store.test.ts`, `taskflow/src/routes/dashboard/IssueDetailView.tsx`
**Commit:** b35b8f1d
**Applied fix:**
- `IssueDetailView` now always sends `parentKey`, with `undefined` when the issue has no parent. Its data comes from `fetchIssueDetail` with `fields=*navigable`, which includes `parent`, so this push is authoritative.
- The store treats the presence of a `parentKey` property as authoritative. The old parent's title and type are kept only when the parent is unchanged.
- Pushes that leave out `parentKey` (main.tsx, MR pushes) still keep the stored parent, and the existing test for that still passes.

### WR-08: MR de-duplication and title lookup use `iid` only

**Files modified:** `taskflow/src/components/app/CommandPalette.tsx`, `taskflow/src/components/app/CommandPalette.test.tsx`, `taskflow/src/components/app/RecentItemsPopover.tsx`, `taskflow/src/components/app/RecentItemsPopover.test.tsx`, `taskflow/src/components/app/RecentItemRow.tsx`
**Commit:** f63ca913
**Applied fix:**
- `mrsMap` and the React row key now use `${project_id}/${iid}`.
- A new helper, `recentMrMatches`, compares composite recent ids on both project and iid. Legacy bare-iid ids still match by iid. The palette and the popover both use it for recent MR titles.

### WR-09: Closed sprint-board subtasks skip the done→Closed routing

**Files modified:** `taskflow/src/lib/global-search.ts`, `taskflow/src/lib/global-search.test.ts`
**Commit:** a4860dab
**Applied fix:** `addSubtasks` now uses the backlog path's rule: a done subtask whose inherited tier is not the current sprint goes to `CLOSED_ID`.
**Status:** fixed: requires human verification (tier-routing logic)

---

_Fixed: 2026-10-16T15:31:17Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
