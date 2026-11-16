---
phase: 94-release-detail-redesign-nicer-professional-page-with-more-re
plan: 06
subsystem: release-detail
tags: [react, header, skeleton, sticky, tests]
requires: [94-02, 94-03]
provides:
  - ReleaseDetailHeader (CycleHeader style) and ReleaseDoneBar
  - full-width ReleaseDetailSkeleton
  - sticky UnifiedTaskTable column header
affects: [94-07 page assembly]
key-files:
  modified:
    - taskflow/src/routes/dashboard/release-detail/ReleaseHeader.tsx
    - taskflow/src/routes/dashboard/release-detail/ReleaseHeader.test.tsx
    - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSkeleton.tsx
    - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.tsx
    - taskflow/src/routes/dashboard/release-detail/UnifiedTaskTable.test.tsx
    - taskflow/src/routes/dashboard/release-detail/LabelSummarySection.tsx
    - taskflow/src/routes/dashboard/release-detail/DeploymentPackageSection.tsx
    - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
  created:
    - taskflow/src/routes/dashboard/release-detail/ReleaseDetailSkeleton.test.tsx
metrics:
  tasks: 3
  completed: 2026-10-30
---

# Phase 94 Plan 06: Header, done bar, skeleton, sticky strip Summary

CycleHeader-style release header (h1 text-lg, status pill, Refreshed text, icon-only refresh, Pin/Edit/Open in Jira, date/package/facts meta line, description), a separate full-width ReleaseDoneBar that owns the "N / M done" figure, a full-width skeleton, and a sticky task-table column header.

## Commits
- 027d8fd4: header + done bar + interim ReleaseDetailPage wiring (15 header tests)
- 8a000566: full-width skeleton + tests (3)
- e563d7c7: sticky column strip, Labels / Deployment package heading restyle

## Deviations from Plan
- Worktree base was 89f0de36; reset to the expected 66f3b333 at startup per the base check.
- Plan did not specify a count change in the Deployment package heading; it now reads "Deployment package mismatches (N)" per the plan's heading instruction. No existing test asserted the old string.
- Pre-commit hook hit the known spurious timeouts (WorklogsPage, EpicDetailSheet, IssueDetailSheet) on two attempts; retries passed with the full suite green.
- Interim page wiring: lastRefreshed=null, refreshing=false, onRefresh no-op, statusNames=null (plan 07 replaces these). The old sidebar remains on the page.

## Known Stubs
- ReleaseDetailPage passes `onRefresh={() => {}}`, `lastRefreshed={null}`, `statusNames={null}`; plan 07 wires real values.

## Self-Check: PASSED
