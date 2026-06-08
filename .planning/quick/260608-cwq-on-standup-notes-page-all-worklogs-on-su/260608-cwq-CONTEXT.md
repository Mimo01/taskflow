# Quick Task 260608-cwq: On standup notes page, all worklogs on subtask/story are groupped together. I want to see each log separately with it's description - Context

**Gathered:** 2026-06-08
**Status:** Ready for planning

<domain>
## Task Boundary

On the standup notes page, worklogs for a subtask/story are currently grouped/aggregated together into a single entry. The goal is to display each individual worklog as its own row, with its description visible.

</domain>

<decisions>
## Implementation Decisions

### Worklog row layout
- Show duration + description only (no author, no timestamp)

### Grouping removal scope
- Flat list under each issue — each worklog appears as its own row directly under the issue, no sub-grouping

### Empty description handling
- Show placeholder text "(no description)" when a worklog has no description field

### Claude's Discretion
- Exact visual styling/spacing of the individual worklog rows (padding, font size, color) — follow existing UI patterns

</decisions>

<specifics>
## Specific Ideas

No specific references — open to standard approaches consistent with existing standup notes UI patterns.

</specifics>
