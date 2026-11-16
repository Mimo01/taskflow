---
phase: 94-release-detail-redesign-nicer-professional-page-with-more-re
plan: 07
subsystem: release-detail
tags: [react, layout, settings-migration, cleanup]
requires: [94-01, 94-02, 94-03, 94-04, 94-05, 94-06]
provides:
  - full-width ReleaseDetailPage (single scroll wrapper, graph quad + side column)
  - settings persist v32 (releaseDetailPanelWidth removed)
key-files:
  created:
    - taskflow/src/routes/dashboard/ReleaseDetailPage.test.tsx
  modified:
    - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
    - taskflow/src/stores/settings.store.ts
    - taskflow/src/stores/settings.store.test.ts
  deleted:
    - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.tsx
    - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSidebar.test.tsx
    - taskflow/src/routes/dashboard/release-detail/DescriptionsSection.tsx
    - taskflow/src/routes/dashboard/release-detail/MetaRow.tsx
metrics:
  tasks: 2
  completed: 2026-10-30
---

# Phase 94 Plan 07: Page assembly Summary

Release detail is now full width: fixed breadcrumb bar, then one `release-detail-scroll` wrapper (`@container/page`, `overflow-auto`) holding header, done bar, graph grid (Burnup | MR donut / By assignee | By type, plus a side column with Labels and Deployment package mismatches) and the unified task table. The sidebar, its resize handle and the `releaseDetailPanelWidth` setting are gone.

## Commits
- a74035a1: page rewrite and page test (8 tests)
- f3a38ba5: settings v32 migration, sidebar and helper files deleted

## Details
- Header Refresh calls `refreshReleaseDetail` with a local `refreshing` flag; "Refreshed: HH:MM:SS" comes from `issuesUpdatedAt`; `statusNames` comes from `statusNameSummary`. All plan-06 interim stubs replaced.
- Issue graph state: loading / error / empty / ready from data presence; donut state from gitlab match and milestoneMRs presence. Without GitLab the donut is omitted and the burnup gets `col-span-full`.
- Edit / Create branch / Create milestone dialogs and the CR-06 `canCreateMilestone` guard carried over unchanged.
- v32 migration deletes the persisted width; test covers v31 -> v32 output.
- Old `useResizable`, sidebar refs and caps removed from the page (`hooks/useResizable.ts` untouched).

## Deviations from Plan
- Worktree base was 89f0de36; reset to a72fb63d per the branch check.
- Removed now-unused `mrStateCounts` / `issueStatusCounts` destructuring from the page (hook still returns them).
- Biome reports 4 pre-existing warnings in src/routes/dashboard (not in files touched by this plan's new code); no new flagged files.

## Known Stubs
None.

## Self-Check: PASSED
Commits a74035a1 and f3a38ba5 exist; full vitest suite (264 files) green on both commits; tsc clean; remaining `MetaRow` imports refer to issue-detail/MetaRow, which is kept.
