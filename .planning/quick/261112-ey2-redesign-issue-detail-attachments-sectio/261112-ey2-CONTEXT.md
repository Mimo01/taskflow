# Quick Task 261112-ey2: Issue-detail attachment rows fully clickable - Context

**Gathered:** 2026-11-12
**Status:** Ready for planning

<domain>
## Task Boundary

Issue detail → Attachments section. Non-image file rows (`AttachmentFileRow.tsx`) are only
clickable on the inner name button; the row's padding and empty space up to the hover
actions are dead. Make the whole row (padding included) the preview click target.

</domain>

<decisions>
## Implementation Decisions

### Layout
- KEEP the current split: image thumbnail squares on top, file rows below. No layout redesign.
  (User is interested in a unified tile grid but worried about filename legibility — a
  mockup will be shown separately AFTER this task; do not build tiles here.)

### Previewable rows
- Whole row = click target that opens the preview (every pixel incl. px/py padding, and the
  gap between name/size and the action buttons).
- Use the overlay-button pattern: row container `div.relative group`; an absolutely
  positioned `<button class="absolute inset-0 rounded ...">` sibling with an aria-label
  (e.g. `Preview ${filename}`) and a visible focus-visible ring; icon/name/size content
  `pointer-events-none`; action buttons wrapper `relative z-10`.
- Hover-hidden Download/Delete (opacity-0) must not swallow clicks while invisible: add
  `pointer-events-none group-hover:pointer-events-auto group-focus-within:pointer-events-auto`.
- Name hover underline → `group-hover:underline` (pointer no longer reaches the span).

### Non-previewable rows
- Same as now: no row click action; only hover Download/Delete.

### Claude's Discretion
- Exact focus ring classes; reuse existing ring conventions in the codebase.

</decisions>

<specifics>
## Specific Ideas

Reference implementation of the overlay pattern: `ActivityGroupHeader` in `IssueActivityGroup.tsx`.
Gotcha: any `relative` wrapper after the overlay paints above it — give it pointer-events-none
on its gaps or keep it tight to the buttons.

</specifics>
