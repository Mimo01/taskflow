---
phase: 49-fix-backlog-wiring-and-doc-debt
plan: 01
subsystem: ui
tags: [react-query, backlog, avatar, cache-invalidation, query-keys]

requires:
  - phase: 48-restore-backlog-progressive-loading
    provides: "BacklogPage split into 3 per-section queries (jira-sprint-stories, jira-sprint-list, jira-backlog-issues)"

provides:
  - "All jira-backlog-view query key references replaced with the 3 actual BacklogPage keys"
  - "Sidebar hover on /backlog prefetches jira-sprint-stories, jira-sprint-list, and jira-backlog-issues"
  - "Mutation invalidation sites (useIssueMutations, FieldsSection, useFieldMutation) target actual BacklogPage query keys"
  - "RecentItemsPopover and main.tsx cache search use flat JiraIssue[] data shape"
  - "BacklogRow uses CachedAvatar for assignee (disk-cache support, null fallback)"

affects: [backlog, sidebar-prefetch, issue-mutations, recent-items, avatar-caching]

tech-stack:
  added: []
  patterns:
    - "Prefetch queries that don't depend on boardId outside the fetchQuery.then() chain"
    - "Cache search for flat JiraIssue[] array entries (not sprints[].issues nested shape)"

key-files:
  created: []
  modified:
    - taskflow/src/components/app/Sidebar.tsx
    - taskflow/src/main.tsx
    - taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts
    - taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx
    - taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts
    - taskflow/src/components/app/RecentItemsPopover.tsx
    - taskflow/src/routes/dashboard/BacklogRow.tsx
    - taskflow/src/routes/dashboard/IssueDetailSheet.test.tsx

key-decisions:
  - "Sprint-stories and backlog-issues prefetch fire immediately (no boardId dependency); only jira-sprint-list prefetch is gated on boardId resolution"
  - "CachedAvatar at size=24 matches the previous w-6 h-6 bare img and handles both assigned and unassigned states"

patterns-established:
  - "Flat cache search pattern: getQueriesData<JiraIssue[]> then findTitle/find directly (no nested sprints[].issues traversal)"

requirements-completed: [QOPT-03, CACH-01]

duration: 10min
completed: 2026-04-04
---

# Phase 49 Plan 01: Fix Backlog Wiring and Doc Debt Summary

**Replaced all dead `jira-backlog-view` query key references with the 3 actual BacklogPage keys (jira-sprint-stories, jira-sprint-list, jira-backlog-issues) across sidebar prefetch, mutation invalidation, and cache search; migrated BacklogRow avatar from bare `<img>` to CachedAvatar.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-04T19:45:00Z
- **Completed:** 2026-04-04T19:55:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Fixed sidebar prefetch: hovering /backlog now prefetches all 3 actual BacklogPage query keys instead of the dead `jira-backlog-view` key
- Fixed 4 mutation/invalidation sites (useIssueMutations, FieldsSection, useFieldMutation, handleCreateModalClose) to use `jira-sprint-stories` and `jira-backlog-issues` so issue edits/creates trigger immediate backlog re-renders
- Fixed RecentItemsPopover and main.tsx notification title resolution to use flat JiraIssue[] cache shape instead of nested sprints[].issues traversal
- Migrated BacklogRow assignee avatar from bare `<img>` + unassigned span to CachedAvatar (disk-cache, initials fallback, error recovery)

## Task Commits

1. **Task 1: Fix Sidebar prefetch and mutation invalidation sites** - `37703a3` (fix)
2. **Task 2: Migrate BacklogRow avatar to CachedAvatar** - `46a1a04` (fix)

## Files Created/Modified

- `taskflow/src/components/app/Sidebar.tsx` - Replaced jira-backlog-view prefetch with 3 parallel prefetches for jira-sprint-stories, jira-sprint-list (boardId-gated), and jira-backlog-issues; replaced fetchBacklogView import with fetchBacklogIssues + fetchSprintList
- `taskflow/src/main.tsx` - Fixed backlog cache title search (flat arrays) and handleCreateModalClose invalidation
- `taskflow/src/routes/dashboard/create-edit-issue/useIssueMutations.ts` - Fixed invalidation in onSuccess
- `taskflow/src/routes/dashboard/issue-detail/FieldsSection.tsx` - Fixed invalidation in onSettled
- `taskflow/src/routes/dashboard/issue-detail/useFieldMutation.ts` - Fixed invalidation in onSettled
- `taskflow/src/components/app/RecentItemsPopover.tsx` - Fixed cache search to use flat jira-sprint-stories / jira-backlog-issues
- `taskflow/src/routes/dashboard/BacklogRow.tsx` - Replaced bare img + unassigned span with CachedAvatar size=24
- `taskflow/src/routes/dashboard/IssueDetailSheet.test.tsx` - Updated invalidation assertions (7 -> 8 calls, jira-backlog-view -> jira-sprint-stories + jira-backlog-issues)

## Decisions Made

- Sprint-stories and backlog-issues prefetch fire immediately outside the boardId `.then()` chain since they have no boardId dependency — only jira-sprint-list needs boardId
- CachedAvatar at size=24 renders `w-6 h-6` matching the previous bare img dimensions

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All jira-backlog-view references eliminated; BacklogPage queries are now fully wired across the app
- Plan 49-02 (doc debt) can proceed independently

---
*Phase: 49-fix-backlog-wiring-and-doc-debt*
*Completed: 2026-04-04*
