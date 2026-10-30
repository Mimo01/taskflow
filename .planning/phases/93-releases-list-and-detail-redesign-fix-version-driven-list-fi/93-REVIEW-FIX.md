---
phase: 93-releases-list-and-detail-redesign-fix-version-driven-list-fi
fixed_at: 2026-10-30T09:12:00Z
review_path: .planning/phases/93-releases-list-and-detail-redesign-fix-version-driven-list-fi/93-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 93: Code Review Fix Report

**Fixed at:** 2026-10-30T09:12:00Z
**Source review:** .planning/phases/93-releases-list-and-detail-redesign-fix-version-driven-list-fi/93-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (Critical + Warning; Info IN-01..IN-04 out of scope)
- Fixed: 4
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

## Skipped Issues

None.

---

_Fixed: 2026-10-30T09:12:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
