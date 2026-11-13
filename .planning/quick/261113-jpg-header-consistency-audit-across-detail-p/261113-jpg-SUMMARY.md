---
phase: quick-261113-jpg
plan: 01
subsystem: ui
tags: [detail-header, react-compiler, release, aio, merge-request]
key-files:
  created:
    - taskflow/src/components/ui/detail-header.tsx
    - taskflow/src/components/ui/detail-header.test.tsx
    - taskflow/src/hooks/useCompactOnScroll.ts
    - taskflow/src/hooks/useCompactOnScroll.test.ts
    - taskflow/src/routes/dashboard/MergeRequestDetailPage.test.tsx
  modified:
    - taskflow/src/routes/dashboard/issue-detail/IssueDetailHeader.tsx
    - taskflow/src/routes/dashboard/IssueDetailView.tsx
    - taskflow/src/routes/dashboard/release-detail/ReleaseHeader.tsx
    - taskflow/src/routes/dashboard/aio-cycle/CycleHeader.tsx
    - taskflow/src/routes/dashboard/ReleaseDetailPage.tsx
    - taskflow/src/routes/dashboard/AioCycleDetailPage.tsx
    - taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx
    - taskflow/src/routes/dashboard/AioTestRunDetailPage.tsx
requirements-completed: [QUICK-261113-jpg]
---

# Quick 261113-jpg: Shared DetailHeader across detail pages

Shared `DetailHeader` extracted from the approved issue header; Issue, Release, AIO cycle, MR and AIO run detail pages now all render one header bar above their scroller that condenses on scroll. Task 4 (UAT) is not done: it is a human checkpoint.

## Commits
- 448e6b40 refactor: extract DetailHeader from IssueDetailHeader (Task 1)
- 40df5e06 feat: release + AIO cycle detail use DetailHeader (Task 2)
- 6cb327b2 feat: MR + AIO run detail use DetailHeader (Task 3)

IssueDetailHeader.test.tsx, IssueDetailPage.progressive.test.tsx and PeekPanel.test.tsx are unmodified and green. Full pre-commit suite (vitest, biome, tsc) passed on each commit.

## Decisions / deviations
- Added a `trimTrail` prop to DetailHeader (not in the plan's API). The issue header shows the back button for the full trail but hides the last entry when it is the parent crumb; passing a pre-trimmed trail would have lost the back button in that case.
- ReleaseDetailHeader props are now optional (loading state renders only nav + rocket); `onOpenInJira` prop and `handleOpenInJira` dropped since the primitive owns the Open/Copy pair.
- MR Refresh uses `useIsFetching` + `invalidateQueries` with a predicate over the five `gitlab-mr-*` roots keyed `[root, projectId, iid]`. Copy-link labels for MR: "Copy GitLab link".
- AIO run keeps the key as identity at all times (`Run <id>` fallback); title falls back to key/`Run <id>` as before, skeleton via `titlePlaceholder` while runs load.
- MRDetailSkeleton root changed from `h-full` to `min-h-0 flex-1` so it fits under the new header.
- Test fixes (mocks/queries only, no production bending): getByText(title) -> heading role, 1-entry trail -> getAllByRole()[0], Edit/Open tests stub a 1100px ResizeObserver.
- AioCycleDetailPage compile bailout (try/finally) fixed with `.finally()`; compile guard now covers detail-header, useCompactOnScroll, IssueDetailHeader, ReleaseHeader, CycleHeader and all four pages.

## Known stubs
None.

## UAT (Task 4, pending, user)
1. Issue detail (page and peek) looks identical to 261113-cth.
2. Release: one bar, rocket + pill, h1 2-line clamp, condense on scroll, table header still sticks, Refresh tooltip time, Open in Jira + Copy link.
3. Short release / long expanded description: no flicker; description scrolls inside 40vh.
4. AIO cycle: one bar, meta collapses on scroll, tab bar and column headers stick, Refresh/Pin.
5. MR: header spans sidebar, condenses with left column only, Open in GitLab + Copy, Refresh.
6. AIO run: single bar, cycle crumb always present, prev/next visible at every width, condenses (main column wide, page narrow).
7. Below 860px / 720px: secondary tools in ⋯, primary pair in ⋯ under 720, labels never wrap.

## Self-Check: PASSED
Commits 448e6b40, 40df5e06, 6cb327b2 present; created files exist.

## UAT (2026-11-13)

Approved by the user. Review warnings WR-01..04 left open (advisory, see REVIEW.md).
