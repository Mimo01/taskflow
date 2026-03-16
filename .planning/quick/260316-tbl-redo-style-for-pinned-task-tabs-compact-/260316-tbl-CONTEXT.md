# Quick Task 260316-tbl: Redo style for pinned task tabs - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Task Boundary

Redo style for pinned task tabs. They should be more compact. When loading, the PROJ-123 id should be on the full tab and when it loads, it should minimize and populate with the task summary and icon.

</domain>

<decisions>
## Implementation Decisions

### Loading Tab Size & Layout
- Loading state shows a compact tab with a generic placeholder icon and the issue key (e.g., `[?] PROJ-123`)
- Width ~110px — just icon + key, no skeleton summary area

### Minimize Animation
- Smooth transition (~150ms) when data loads — tab content and width animate from loading state to compact loaded state
- No layout jank — smooth width + content transition

### Compact Tab Content
- Loaded tab shows all three: type icon + issue key + truncated summary
- Compact layout — all visible but space-efficient
- Close button remains (hover-visible as current)

### Claude's Discretion
- Exact pixel dimensions for compact loaded tab width constraints
- Font sizing adjustments for compact layout
- Whether key and summary sit on one line or are stacked

</decisions>

<specifics>
## Specific Ideas

- Loading state: placeholder icon (e.g., circle/loader) + monospace issue key
- Loaded state: colored type icon + key + summary, all compact
- Transition: ~150ms smooth shrink/expand with content swap

</specifics>
