---
status: resolved
trigger: "backlog-progressive-loading-broken"
created: 2026-04-05T00:00:00Z
updated: 2026-04-05T00:00:00Z
---

## Resolution

root_cause: |
  Two issues caused the backlog view to load slowly and without progressive rendering:
  1. fetchBacklogSprintStories used the slow Agile board endpoint (/rest/agile/1.0/board/{id}/issue)
     instead of the fast standard search API (/rest/api/2/search). This made sprint stories the
     bottleneck — much slower than backlog issues which use the standard search API.
  2. Loading state management had gaps: jiraToken loads async (readSecret), and before it resolved
     all queries were disabled (isLoading=false, data=undefined) — triggering "Backlog is empty"
     flash. Additionally, the skeleton disappeared too early (between boardId and sprintList loading).

fix: |
  1. Rewrote fetchBacklogSprintStories to accept sprintIds[] and use standard search API per-sprint
     in parallel. Each issue tagged with fields.sprint = { id } for grouping. Much faster.
  2. Reordered queries: sprint list loads first (Query 1), sprint stories depend on sprint IDs from
     the list (Query 2). Headers render from sprint list alone; stories fill in progressively.
  3. Fixed loading state: added authBootstrapping (!jiraToken) and waitingForSprintList checks to
     isAnyLoading. Skeleton stays until sprint list + backlog are both ready. Empty state also
     guards against auth bootstrapping and sprint list loading.
  4. Updated Sidebar prefetch to chain: boardId → sprint list → sprint stories.

verification: TypeScript clean, 15/16 tests pass (1 pre-existing failure unrelated to this fix).
files_changed:
  - taskflow/src/services/jira/backlog.ts
  - taskflow/src/routes/dashboard/BacklogPage.tsx
  - taskflow/src/components/app/Sidebar.tsx
  - taskflow/src/routes/dashboard/BacklogPage.test.tsx
