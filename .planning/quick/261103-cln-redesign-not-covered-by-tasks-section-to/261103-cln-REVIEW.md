---
phase: 261103-cln
reviewed: 2026-11-03T00:00:00Z
depth: quick
files_reviewed: 9
files_reviewed_list:
  - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
  - taskflow/src/routes/dashboard/release-detail/DeploymentPackageSection.tsx
  - taskflow/src/routes/dashboard/release-detail/NotCoveredFixActions.tsx
  - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx
  - taskflow/src/routes/dashboard/release-detail/calloutSection.ts
  - taskflow/src/routes/dashboard/release-detail/notCoveredFixes.ts
  - taskflow/src/routes/dashboard/release-detail/useMrFixMutation.ts
  - taskflow/src/services/gitlab.ts
  - taskflow/src/services/jira.ts
findings:
  critical: 0
  warning: 4
  info: 2
  total: 6
status: issues_found
---

# Phase 261103-cln: Code Review Report

**Depth:** quick (diff read plus targeted greps; no tests run)

## Summary

No blockers found. The Jira `update.fixVersions[{add}]` call keeps existing versions, and the issue-key regex runs before any fetch. The GitLab title PUT uses an explicit field pick. The `['jira-fixversion-issues', versionId]` invalidation prefix matches the live key `[..., versionId, storyPointsFieldKey]`. Draft handling is mostly right but has gaps.

## Warnings

### WR-01: Link-task title write is based on a possibly stale cached title
**File:** `taskflow/src/routes/dashboard/release-detail/notCoveredFixes.ts:84-86`
**Issue:** The new title is built from `mr.title` in the 5-minute-stale cache, and the PUT sends the full title. If the title was edited in GitLab (or the draft status toggled) since the last fetch, this silently overwrites it, and can un-draft an MR that was drafted after the cache was filled.
**Fix:** Fetch the MR first (`GET .../merge_requests/:iid`) and build the title from `title`, or only send when `fresh.title === mr.title`.

### WR-02: Draft regex misses forms GitLab treats as draft
**File:** `taskflow/src/routes/dashboard/release-detail/notCoveredFixes.ts:12`
**Issue:** `/^\s*(?:\[draft\]|\(draft\)|draft:|wip:)\s*/i` does not match `[WIP]`, `(WIP)` or `Draft -` / `Draft ` variants. A title like `[WIP] foo` becomes `ABC-1 [WIP] foo`, which is silently un-drafted. Stacked prefixes (`Draft: [Draft] x`) are also only half-preserved.
**Fix:** Use `/^\s*(?:(?:\[|\()?(?:draft|wip)(?:\]|\))?:?\s*)+/i`, or loop-match prefixes, and add tests for `[WIP]`.

### WR-03: Release header and breakdown seed not invalidated after Apply
**File:** `taskflow/src/routes/dashboard/release-detail/notCoveredFixes.ts:68-69`
**Issue:** Only `jira-issue-detail` and `jira-fixversion-issues` are invalidated. `lib/release-refresh.ts:68` shows the codebase's own full-refresh list, and `releaseBreakdownSeedKey(...)` (`useReleaseDetail.ts:498`) is a separate key. The header breakdown and the Releases-list counts can stay stale. `['jira-issue-detail']` with no suffix also refetches every cached issue detail.
**Fix:** Reuse the helper in `release-refresh.ts` (or add the seed key). Narrow the detail invalidation to `[..., key, jiraBaseUrl]`.

### WR-04: Errors persist if a row's reason changes or the row is hidden
**File:** `taskflow/src/routes/dashboard/release-detail/notCoveredFixes.ts:34-48`, `UnifiedTaskTable.tsx` (`shownSecondaryRows`)
**Issue:** `errors` are keyed by `mr.id` at section level and cleared only on a retry of that same MR. A failed row that is collapsed behind "Show all N" or filtered out has its error invisible. The error also reappears later with no context if the row comes back.
**Fix:** Prune entries whose `mr.id` is not in `filteredSecondaryRows`, or clear errors on filter change.

## Info

### IN-01: Redundant aliases in DeploymentPackageSection
**File:** `taskflow/src/routes/dashboard/release-detail/DeploymentPackageSection.tsx:123-125,142`
**Issue:** `APPLY_CLASS`, `COL_FIX_ACTION`, `HEADER_CLASS` and `VISIBLE_ROWS` just re-alias `CALLOUT_*`, and other `CALLOUT_*` constants are also used directly. The file is inconsistent about which form it uses.
**Fix:** Replace the aliases with the `CALLOUT_*` names directly.

### IN-02: `jiraFix` prop is built inline in the page
**File:** `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx:569`
**Issue:** `jiraFix={versionId ? { baseUrl: jiraBaseUrl ?? null, versionId } : undefined}` builds a new object each render. The React Compiler memoizes it, so this is harmless. However, `useNotCoveredFixes` calls `readSecret('jira-pat')` on every Apply, and `jiraBaseUrl` being null is reported only as the generic "Jira is not configured".
**Fix:** None required. Optionally give a clearer message when `versionId` is missing versus `baseUrl` missing.
