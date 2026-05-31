# Quick Task 260531-3ey: Sprint board filters row overflow - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning

<domain>
## Task Boundary

On the Sprint Board, the filters row currently widens/drags the entire page when its
content overflows. It should instead be full-width with horizontal scroll overflow,
while the right-side action buttons (Filter, Save, "...") stay pinned on the right and
are NOT affected by the scroll.

Affected component: `taskflow/src/components/UnifiedFilterBar.tsx` (rendered by
`SprintBoardTab.tsx`). The active filter chips currently use `flex flex-wrap`, and the
right-side buttons sit after a `flex-1` spacer within the same single flex container —
so overflow pushes layout width instead of scrolling.
</domain>

<decisions>
## Implementation Decisions

### Scroll scope
- Left content (quick-filter preset pills + active filter chips) lives in a scrollable
  `flex-1 min-w-0` region that scrolls horizontally.
- Right-side action buttons (Save / Save Filter / Filter button + count) stay pinned on
  the right, are `shrink-0`, and never scroll.

### Chip behavior on overflow
- Single-row horizontal scroll. Switch the chips container from `flex-wrap` to
  `flex-nowrap` (no wrapping); chips stay on one line and scroll.

### Scrollbar appearance (Claude's Discretion)
- Hidden scrollbar — reuse the existing `no-scrollbar` utility + `overflow-x-auto`,
  matching the established `QuickFilterChipRow.tsx` convention. Scroll via
  trackpad / shift-wheel.

### Which rows (Claude's Discretion)
- Apply to BOTH the primary filters row and the expanded-filters row (`filtersOpen`),
  since both render wrapping chip containers.
- `QuickFilterChipRow.tsx` already has `overflow-x-auto no-scrollbar` — leave as-is
  (only verify it isn't the page-drag culprit; do not regress it).

</decisions>

<specifics>
## Specific Ideas

- Container fix pattern: outer row is `flex`, left region `flex-1 min-w-0 overflow-x-auto
  no-scrollbar` with inner `flex-nowrap`, right action group `shrink-0`. `min-w-0` is the
  critical bit that lets a flex child shrink below content width and actually scroll
  instead of pushing the parent wide.
- Existing right-side buttons currently follow a `flex-1` spacer (line ~329/562 area in
  UnifiedFilterBar.tsx) — the `flex-1` spacer is replaced by the scrollable left region
  growing to fill space.

</specifics>

<canonical_refs>
## Canonical References

No external specs — `QuickFilterChipRow.tsx` (`overflow-x-auto no-scrollbar`) is the
in-repo precedent for the scroll/scrollbar styling.

</canonical_refs>
