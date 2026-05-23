# Quick Task 260316-tdk: Redo breadcrumb navigation on issue detail - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Task Boundary

Redo how breadcrumbs on issue detail work. By default they should be empty. When clicking an issue from a list page, populate breadcrumbs with the source page name. When drilling issue→issue, stack onto breadcrumbs. Tab clicks should show no breadcrumbs. Switching away to another tab or page fully resets breadcrumbs.

</domain>

<decisions>
## Implementation Decisions

### Back Source Label
- Show the source page name as the first breadcrumb entry (e.g. "Sprint Board", "Backlog", "My Tasks")
- This tells the user where they came from and provides navigable context

### Deep Drill Display
- Full stack — show all ancestors in the trail: `Sprint Board / PROJ-1 / PROJ-2 / PROJ-3`
- No truncation, no collapse

### Back Button Behavior
- Back arrow pops the breadcrumb trail (not browser history)
- Predictable: always goes to parent in trail
- When trail is empty, back arrow should navigate to a sensible default (e.g. previous route or home)

</decisions>

<specifics>
## Specific Ideas

- Breadcrumbs empty by default (no issue key shown when no trail)
- Tab clicks (pinned tabs) → no breadcrumbs, trail reset
- List page → issue: first entry = page name (Sprint Board, Backlog, etc.)
- Issue → issue: push current issue onto trail
- Navigate away to any non-issue route → full reset
- Back arrow follows breadcrumb stack, not browser history

</specifics>
