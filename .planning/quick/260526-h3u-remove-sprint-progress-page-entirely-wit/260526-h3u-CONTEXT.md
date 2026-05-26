# Quick Task 260526-h3u: Remove Sprint progress page entirely without replacement - Context

**Gathered:** 2026-05-26
**Status:** Ready for planning

<domain>
## Task Boundary

Remove the Sprint Progress page and all associated files entirely — no replacement UI, no redirect.

</domain>

<decisions>
## Implementation Decisions

### Cleanup Scope
- Full delete: remove SprintProgressTab.tsx, SprintProgressSkeleton.tsx, SprintProgressTab.test.tsx, and all routing/sidebar/navigation references

### SprintHealthPanel
- Delete SprintHealthPanel.tsx and SprintHealthPanel.test.tsx — it is an orphan component (not rendered in production, only referenced in comments and its own test)

### Dead References
- Clean all dead references across the entire codebase — remove or update any import, link, or reference to SprintProgress or SprintHealthPanel in files like WikiRenderer.tsx, WorklogsPage.tsx, DashboardSprintCard.tsx comments, DashboardInProgressCard.tsx comments, routes.tsx, sidebar-items.ts, main.tsx

### Claude's Discretion
- Order of deletions (files first, then reference cleanup)
- How to handle DashboardInProgressCard cache key comments that mention SprintHealthPanel (remove the comment lines referencing it)

</decisions>

<specifics>
## Specific Ideas

Files confirmed to reference SprintProgress or SprintHealthPanel (non-test):
- `src/main.tsx`
- `src/components/app/sidebar-items.ts`
- `src/routes/routes.tsx`
- `src/routes/dashboard/WikiRenderer.tsx`
- `src/routes/dashboard/SprintHealthPanel.tsx` (delete)
- `src/routes/dashboard/SprintProgressSkeleton.tsx` (delete)
- `src/routes/dashboard/DashboardSprintCard.tsx` (comment cleanup)
- `src/routes/dashboard/SprintProgressTab.tsx` (delete)
- `src/routes/dashboard/DiscussionThreads.tsx`
- `src/routes/worklogs/WorklogsPage.tsx`
- `src/routes/dashboard/DashboardInProgressCard.tsx` (comment cleanup)

</specifics>
