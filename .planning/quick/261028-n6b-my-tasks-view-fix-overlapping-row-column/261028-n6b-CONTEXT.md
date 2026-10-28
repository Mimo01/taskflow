# Quick Task 261028-n6b: My Tasks rows overlap on small widths - Context

**Gathered:** 2026-10-28
**Status:** Ready for planning

<domain>
## Task Boundary

My Tasks view (`taskflow/src/routes/my-tasks/MyTaskRow.tsx`, page `MyTasksPage.tsx`): on smaller widths the columns inside a row overlap. Hide the story-points column and the labels at small widths, and optimise the row for a range of widths.

</domain>

<decisions>
## Implementation Decisions

### Drop order (narrowing)
- Tier 1: hide story-points slot and label chips.
- Tier 2: MR-health and Flagged chips become icon-only (text hidden; keep accessible name via aria-label/title).
- Tier 3: time bar shrinks, then hides.
- Always visible: type icon, key, summary (truncates), status pill, avatar.
- Subtask rows must follow the same tiers so right-edge columns stay aligned with parents.

### Breakpoints
- Key off the page's existing `@container` (MyTasksPage.tsx:750), using Tailwind v4 `@`-variants on row descendants — NOT window width, so the peek panel / sidebar narrowing also triggers it.
- Container query variants never style the container itself (use descendants only).

### Claude's Discretion
- Exact container breakpoint values; whether the time bar shrinks via narrower fixed width before hiding.

</decisions>

<specifics>
## Specific Ideas

- Preserve WebKit/Tauri guards from the file header: explicit px widths on fixed columns, status pill in a flex parent, no negative margins.
- One row = one line at every width (no wrapping to a second line).

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

</canonical_refs>
