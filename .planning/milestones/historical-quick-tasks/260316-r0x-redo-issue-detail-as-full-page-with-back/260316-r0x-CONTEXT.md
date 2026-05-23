# Quick Task 260316-r0x: Redo issue detail as full page with back/breadcrumb navigation - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Task Boundary

Replace the current IssueDetailSheet (75vw slide-out panel) with a full-page route-based issue detail view. All issue clicks navigate to `/issue/:key`. Add back arrow + breadcrumb navigation to return to the originating page.

</domain>

<decisions>
## Implementation Decisions

### Issue click behavior
- All issue clicks (sprint board, backlog, search, notifications, pinned tabs) navigate to the full-page issue detail route
- The Sheet overlay is removed entirely
- No dual-mode (sheet vs page) — single consistent behavior

### Back navigation UX
- Back arrow button at top-left of the issue detail page
- Breadcrumb trail showing origin, e.g. "Sprint Board > PROJ-123"
- Both are present — back arrow for quick return, breadcrumb for context

### Layout on issue page
- Keep all app chrome: Sidebar, TopBar, and PinnedTabStrip remain visible
- Issue detail fills the main content area (the `<main>` section)
- Standard app layout is preserved — issue detail is just another route

### Claude's Discretion
- URL structure for issue detail route (e.g. `/issue/:key`)
- How to track "previous page" for breadcrumb (location state, history, or store)
- Whether to keep EpicDetailSheet or also convert it

</decisions>

<specifics>
## Specific Ideas

- Pinned tab clicks should navigate to the issue page route, not open a sheet
- The breadcrumb should reflect the actual page the user came from (e.g. "Sprint Board", "Backlog", "Epics")
- Consider using React Router's location state to pass the origin page info

</specifics>
