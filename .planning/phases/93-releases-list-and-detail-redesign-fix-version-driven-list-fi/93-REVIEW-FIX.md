---
phase: 93-releases-list-and-detail-redesign-fix-version-driven-list-fi
fixed_at: 2026-10-30T10:20:00Z
review_path: .planning/phases/93-releases-list-and-detail-redesign-fix-version-driven-list-fi/93-REVIEW.md
iteration: 2
findings_in_scope: 8
fixed: 8
skipped: 0
status: all_fixed
---

# Phase 93: Code Review Fix Report

**Fixed at:** 2026-10-30T10:20:00Z (iteration 1, WR-01..WR-04: 2026-10-30T09:12:00Z)
**Source review:** .planning/phases/93-releases-list-and-detail-redesign-fix-version-driven-list-fi/93-REVIEW.md
**Iteration:** 2

**Summary:**
- Findings in scope: 8 (WR-01..WR-04 fixed in iteration 1, IN-01..IN-04 in iteration 2)
- Fixed: 8
- Skipped: 0

## Fixed Issues

### WR-01: Breakdown fetch errors are computed but never surfaced

**Files modified:** `taskflow/src/components/release/ReleaseIssueGraph.tsx`, `taskflow/src/components/release/ReleaseIssueGraph.test.tsx`, `taskflow/src/hooks/useReleaseBreakdowns.ts`, `taskflow/src/routes/dashboard/ReleasesTab.tsx`, `taskflow/src/routes/dashboard/releases-list/ReleaseAgenda.tsx`, `taskflow/src/routes/dashboard/releases-list/ReleaseAgenda.test.tsx`, `taskflow/src/routes/dashboard/releases-list/ReleaseAgendaParts.tsx`, `taskflow/src/routes/dashboard/releases-list/ReleasedPanel.tsx`, `taskflow/src/routes/dashboard/releases-list/ReleasedPanel.test.tsx`
**Commit:** ce1ade6c
**Applied fix:** `errorIds` now goes from `useReleaseBreakdowns` to the agenda rows, the next-release card and the Released panel. `ReleaseIssueGraph` now uses its `error` prop on the detail header. UI-SPEC line 109 says a per-cell failure shows a "muted `–` with no chip", so the failed state keeps the muted dash. The new `BreakdownErrorDash` adds a "Couldn't load issue counts" title tooltip and `role="img"`/`aria-label`. It uses `pointer-events-auto relative z-10` so it can be hovered above the row overlay button. The hook's `combine` now checks `isFetching` before `isError`, so a Refresh after a failure shows the skeleton instead of the error. Quiet-row promotion is unchanged: a failed row stays quiet, because there is no data.
**Status:** fixed: requires human verification. Please check that the subtle error dash is noticeable enough for you. A small dash cannot be clicked through to open the row.

### WR-02: RM package shows "week, no app task" while children/projects are loading, and permanently if they fail

**Files modified:** `taskflow/src/components/release/ReleasePackageCell.tsx`, `taskflow/src/components/release/ReleasePackageCell.test.tsx`, `taskflow/src/hooks/useReleasePackages.ts`, `taskflow/src/hooks/useRmWeekIndex.ts`, `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx`, `taskflow/src/routes/dashboard/ReleasesTab.tsx`, `taskflow/src/routes/dashboard/release-detail/ReleaseHeader.tsx`, `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts`, `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.test.tsx`, `taskflow/src/routes/dashboard/releases-list/ReleaseAgenda.tsx`, `taskflow/src/routes/dashboard/releases-list/ReleaseAgendaParts.tsx`
**Commit:** dfe3774a
**Applied fix:**
- `ReleasePackageCell` shows a skeleton while `loading && !pkg?.child`, so the week-only state no longer flashes. A child that has already resolved stays visible.
- `useRmWeekIndex` exposes a new `childrenError`. Its existing `isError` meaning is unchanged for other consumers.
- `useReleasePackages` exposes `isError`, which covers a failed week list, failed week children or a failed project lookup.
- The cell takes an optional `error` prop. On failure, the week-only and dash states get a "Couldn't load the RM deployment package" title, raised above overlay buttons. This is wired on list rows, the next-release card and the detail header.
**Status:** fixed: requires human verification. This is a loading/state logic change.

### WR-03: `title` tooltips on truncated release names never appear

**Files modified:** `taskflow/src/routes/dashboard/releases-list/ReleaseAgenda.tsx`, `taskflow/src/routes/dashboard/releases-list/ReleaseAgendaParts.tsx`, `taskflow/src/routes/dashboard/releases-list/ReleaseAgenda.test.tsx`, `taskflow/src/routes/dashboard/ReleasesTab.test.tsx`
**Commit:** 124783e6
**Applied fix:** I moved `title={version.name}` onto the agenda row overlay button and the next-release card overlay button, and removed the dead titles from the `pointer-events-none` name spans. The `rowNameOf` helper in `ReleasesTab.test.tsx` read the titled element's `textContent`, so it now reads the `title` attribute. I added a test asserting that the buttons carry the title and the spans do not.

### WR-04: Detail header pill disagrees with the list row

**Files modified:** `taskflow/src/lib/release-agenda.ts`, `taskflow/src/lib/release-agenda.test.ts`, `taskflow/src/lib/release-list.ts`, `taskflow/src/lib/release-list.test.ts`, `taskflow/src/routes/dashboard/ReleaseDetailPage.tsx`, `taskflow/src/routes/dashboard/release-detail/ReleaseHeader.tsx`, `taskflow/src/routes/dashboard/release-detail/ReleaseHeader.test.tsx`
**Commit:** 03f56de8
**Applied fix:** Before changing anything I checked whether the difference was deliberate. CONTEXT D-13 and UI-SPEC say the header shows "the same status pill" as the list. The only reason the detail page stayed on `releasePill` is a scoping line in 93-07-PLAN: F5 wording supersedes D-05 "for the list page only… because the detail header still uses releasePill". That was deferral, not a UX decision. I found no UAT, SUMMARY or VERIFICATION note choosing different detail wording. The fix:
- Added `releaseHeaderPill`: Released shows a green pill; otherwise it uses `releaseCountdown`.
- The header date now renders with `dateStamp(...).inline`, for example "Mon 02 Nov".
- Deleted the unused `releasePill` and its tests.

### IN-01: Dead `list` variant and unused `error` prop in `ReleaseIssueGraph`

**Files modified:** `taskflow/src/components/release/ReleaseIssueGraph.tsx`, `taskflow/src/components/release/ReleaseIssueGraph.test.tsx`, `taskflow/src/routes/dashboard/release-detail/ReleaseHeader.tsx`
**Commit:** 0afa57fd
**Applied fix:** The `error` half was already done: WR-01 wired up the prop. I removed the `variant` prop and every `variant === 'list'` branch: the reserved figure slot in the skeleton, the `3/6` figure and the `w-12` figure width. The component now always renders the detail layout (`max-w-xl`, `3 / 6 done`), which is exactly what `ReleaseDetailHeader` already got, so nothing changes on screen. I merged the list and detail figure tests into one. I kept `releaseTooltipRows` and the `RELEASE_SEGMENT_*` maps, because `RELEASE_SEGMENT_ORDER`/`CLASS` are still used by `ReleaseAgendaParts` and the tooltip still uses the rest.

### IN-02: `useEditRelease` still invalidates a key that no query uses

**Files modified:** `taskflow/src/routes/dashboard/release-detail/useEditRelease.ts`, `taskflow/src/services/jira.ts`, `taskflow/src/services/jira.versionsBreakdown.test.ts`, `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.test.tsx`
**Commit:** a382d60e
**Applied fix:** I removed the `['jira-version-counts', versionId]` invalidation and kept the `'batch'` one. Nothing in production imports `fetchVersionIssueCounts`; I checked the legacy `services/jira.ts` and the `services/jira/` modules, and the `jira/` modules have no duplicate. I deleted it along with its `VersionIssueCounts` interface. Test cleanup: I removed the "agrees with fetchVersionIssueCounts" parity test and the mock entry and `not.toHaveBeenCalled` assertion in `useReleaseDetail.test.tsx`. The test that checks the hook exposes no `issueCounts` stays. The subtask-exclusion rationale used to live on the deleted function, so I moved it onto `fetchFixVersionIssues`. The `fetchVersionsStatusBreakdown` doc now says it must match `fetchFixVersionIssues`, the detail's own source.

### IN-03: Breakdown chunk and seed keys omit `jiraBaseUrl`

**Files modified:** `taskflow/src/hooks/useReleaseBreakdowns.ts`, `taskflow/src/hooks/useReleaseBreakdowns.test.tsx`, `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.ts`, `taskflow/src/routes/dashboard/release-detail/useReleaseDetail.test.tsx`
**Commit:** cf20b2e9
**Applied fix:** Both key helpers now take `jiraBaseUrl` as their first argument and produce `['jira-version-counts', 'batch', jiraBaseUrl, ids]` and `['jira-version-counts', 'breakdown', jiraBaseUrl, id]`. The base URL comes after the second segment, so the prefix invalidations still match: `['jira-version-counts']` in FieldsSection, useFieldMutation and parentCompletion, and `['jira-version-counts', 'batch']` in release-refresh and useEditRelease. All three key sites go through the helpers with the same `useAuthStore().jiraBaseUrl`: the chunk `queryKey`, the seed `setQueryData` and the detail's fetch-disabled seed `useQuery`. The detail test's literal `SEED_KEY` now includes the base URL, and a seeded read still passes, which shows the write and read keys line up. I added a test that the keys differ per instance and keep the `['jira-version-counts', 'batch']` prefix.

### IN-04: The Released panel renders "✓ 0 done" for released versions with no issues

**Files modified:** `taskflow/src/routes/dashboard/releases-list/ReleasedPanel.tsx`, `taskflow/src/routes/dashboard/releases-list/ReleasedPanel.test.tsx`
**Commit:** 8fea37fe
**Applied fix:** When the breakdown total is zero, the cell now shows the agenda's exact empty slot: `No issues yet` in `text-muted-foreground/75`. I moved the green and `font-medium` classes from the cell wrapper onto the `✓ N done` span only, so the empty state is not tinted green. I added a test for the zero-total case.
**Status:** fixed: requires human verification. I used "No issues yet" to match the agenda, as instructed. For an already-released version, "yet" may read oddly, and you may prefer the reviewer's plain "No issues".

## Skipped Issues

None.

---

_Fixed: 2026-10-30T10:20:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
