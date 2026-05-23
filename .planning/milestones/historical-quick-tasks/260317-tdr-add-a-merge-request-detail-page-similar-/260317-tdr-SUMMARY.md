---
phase: quick-260317-tdr
plan: 01
subsystem: gitlab-mr-detail
tags: [gitlab, merge-requests, routing, sidebar]
dependency_graph:
  requires: [gitlab-api, link-engine, breadcrumb-store]
  provides: [mr-detail-page, mr-list-page, mr-routes]
  affects: [sidebar, router, gitlab-service]
tech_stack:
  added: []
  patterns: [two-column-detail, state-filter-tabs, debounced-search, three-state-detection]
key_files:
  created:
    - taskflow/src/routes/dashboard/MergeRequestDetailPage.tsx
    - taskflow/src/routes/dashboard/MergeRequestListPage.tsx
  modified:
    - taskflow/src/services/gitlab.ts
    - taskflow/src/main.tsx
    - taskflow/src/components/app/Sidebar.tsx
decisions:
  - "RecentItem type uses 'gitlab' (not 'gitlab-mr') to match existing store type union"
  - "MR detail default back navigation goes to /merge-requests when no breadcrumb trail"
metrics:
  duration: 4m
  completed: "2026-03-17T20:29:00Z"
---

# Quick Task 260317-tdr: Add MR Detail Page and MR List Page Summary

MR detail page with two-column layout (description/commits/linked-Jira left, status/author/pipeline/branches right) and dedicated MR list page with state filter tabs and search

## What Was Built

### Task 1: Extend GitLab API + Create MR Detail Page + MR List Page
- Added `GitLabMRDetail` interface extending `GitLabMR` with description, target_branch, labels, pipeline, assignee, draft, conflicts, changes_count, dates
- Added `fetchMRDetail(baseUrl, token, projectId, mrIid)` function following existing API pattern
- Updated `fetchProjectMRs` to accept optional `state` parameter (default 'opened')
- Created `MergeRequestDetailPage.tsx` (290+ lines) with:
  - Two-column layout matching IssueDetailPage structure
  - Left: MR IID, title, draft/state badges, "Open in GitLab" button, rendered description via WikiRenderer, commits list with SHA prefixes, linked Jira issues extracted from title and branch
  - Right sidebar: status, author avatar+name, assignee, reviewers, approvals, labels, pipeline status, source/target branch, conflicts warning, changes count, created/updated/merged dates
  - Breadcrumb navigation header matching IssueDetailPage pattern
  - Skeleton loading state
- Created `MergeRequestListPage.tsx` (200+ lines) with:
  - State filter tabs (Open/Merged/Closed/All) with segmented control UI
  - Debounced text search (300ms) using `searchGitLabMRs`
  - MR rows showing IID, state badge, title, author, branch, updated time
  - Row click navigates to `/mr/:projectId/:iid` with breadcrumb push
  - Three-state detection: ErrorState, StaleDataBanner, EmptyState

### Task 2: Wire Routes + Sidebar Nav + Breadcrumb Integration
- Added `/merge-requests` and `/mr/:projectId/:iid` routes to hash router
- Added `routeLabel` entries for both new routes
- Updated breadcrumb reset `useEffect` to preserve trail on `/mr/` routes
- Added "Merge Requests" NavLink in sidebar shared section after Epics (visible for all roles)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] RecentItem type mismatch**
- **Found during:** Task 1
- **Issue:** Plan suggested `type: 'gitlab-mr'` but RecentItem only allows `'jira' | 'gitlab'`
- **Fix:** Used `'gitlab'` type with composite id `${projectId}/${iid}` for MR recent items
- **Files modified:** MergeRequestDetailPage.tsx, MergeRequestListPage.tsx

**2. [Rule 3 - Blocking] StaleDataBanner requires onDismiss**
- **Found during:** Task 1
- **Issue:** StaleDataBanner component requires `onDismiss` prop but plan didn't mention it
- **Fix:** Added `staleDismissed` state and passed `onDismiss` callback to StaleDataBanner
- **Files modified:** MergeRequestListPage.tsx

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | 56ccde0 | feat(quick-260317-tdr): add MR detail page, MR list page, and fetchMRDetail API |
| 2 | 4a21d91 | feat(quick-260317-tdr): wire MR routes, sidebar nav link, and breadcrumb integration |

## Verification

- TypeScript compiles without errors (pre-existing test file errors only)
- Vite build completes successfully (5.54s, 2592 modules)
