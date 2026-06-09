---
quick_id: 260609-bzk
status: ready-for-planning
---

# Quick Task 260609-bzk: AIO Cycle Defects Side Preview - Context

**Gathered:** 2026-06-09
**Status:** Ready for planning

<domain>
## Task Boundary

On the AIO cycle detail page (AioCycleDetailPage.tsx), the "defects" tab shows a list of defect issues. Clicking on a row should open the side preview (PeekPanel) as the rest of the app does. Clicking the issue key column should navigate to the full-page issue detail (unchanged behavior).

</domain>

<decisions>
## Implementation Decisions

### Row body click
- Opens the PeekPanel (side preview) via `onOpenIssue` from OutletContext — matching BacklogRow/SprintBoardTab pattern

### Key column (NavLink)
- Keeps existing full-page navigation behavior (NavLink → `/issue/{key}` with stopPropagation)

### "Triggered By" key links
- Research finding: "Triggered By" values are AIO test case keys (e.g., PROJ-TC-42), NOT Jira issue keys — PeekPanel only handles Jira keys, so these cannot be wired to onOpenIssue. Leave this column unchanged (no peek, no full-page navigation change).

### Scope
- Defects tab only — do NOT wire peek for test runs or test cases in this task

### Claude's Discretion
- Breadcrumb push behavior: the existing `openDefect` pushes a breadcrumb before navigating; with peek this is no longer needed (PeekPanel doesn't change the route)

</decisions>

<specifics>
## Specific Ideas

- `AioCycleDetailPage` uses `useOutletContext` — extract `onOpenIssue` alongside existing context values
- `openDefect` currently calls `navigate('/issue/...')` — replace with `onOpenIssue(resolvedKey)` 
- `DefectRow.onOpen` is the prop that calls `openDefect` — no change to DefectRow signature needed, just the callback it receives
- "Triggered By" links are rendered inside DefectRow and currently may use NavLink or plain navigation — check and wire to onOpenIssue

</specifics>
