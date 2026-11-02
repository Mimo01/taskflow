# Quick Task 261102-u5r: Redo release detail Progress graph (burnup readability + match timeline) - Context

**Gathered:** 2026-11-02
**Status:** Ready for planning

<domain>
## Task Boundary

Release detail page "Progress" graph slot: `ReleaseBurnup.tsx` (recharts stepAfter burnup, used with `compact` in ReleaseDetailPage) and its thin-history stand-in `ReleaseTimeline.tsx` (done/total + countdown header over a start→today→release track). The user likes the burnup concept but finds it hard to read; likes the timeline a lot and wants both to share one design language.

</domain>

<decisions>
## Implementation Decisions

### What is wrong with the burnup (user-confirmed pain points)
- **Too small / cramped**: compact band plot (~110px min) squeezes lines together.
- **Label clutter**: in-plot end labels (scope/done numbers) + TODAY/RELEASE marker text crowd the right edge.
- (Contrast and colours were NOT flagged — keep green done / muted scope semantics.)

### Unification: shared header (user chose this)
- Extract the timeline's header (big `done / total` "issues done" on the left, countdown "N days left / until <date>" | Released | Due today | overdue | No release date on the right, with existing tones) into a shared piece rendered in BOTH states.
- Ready state: shared header + burnup chart below. Thin-history state: shared header + track below (as today).
- Because the header carries the numbers, REMOVE the in-plot end labels (scope/done numbers) from the chart. Exact values remain in the tooltip.
- Header must be compact (it eats vertical space that the plot needs) — e.g. tighter type/spacing in compact mode; plot must end up LARGER/more readable than today, not smaller. Raise the plot's min height in compact mode if needed.
- Declutter markers: TODAY/RELEASE should not crowd the plot's right edge (Claude's discretion how — e.g. small labels outside the plot area / axis-level, merged when adjacent, as burnupLabelLayout does today).

### Timeline polish
- Fix spacing/sizing: the `justify-evenly` layout floats in the compact band — tighten it.
- Otherwise Claude's discretion to make the timeline and burnup visually match (same header, consistent marker styling: TODAY = solid foreground, RELEASE = muted dashed/outlined, same label typography in both).

### Claude's Discretion
- Exact header sizes, plot min-height, marker label placement, whether burnupLabelLayout end-label logic is deleted or simplified (delete dead code + its tests if end labels go).

</decisions>

<specifics>
## Specific Ideas / standing user preferences (from memory)

- No legends on dashboard/release graphs; tooltips ≤4 rows; colour = status only.
- Compact graphs at every width; no empty or fake-legend graphs.
- Recharts layering: ReferenceLine zIndex 150 (400 paints over line labels); stepAfter last day needs closeLastDay; keep these.
- One row = one line; avoid stacking extra lines in narrow widths.
- React Compiler in app ('use no memo' already at top of ReleaseBurnup).

</specifics>

<canonical_refs>
## Canonical References

- taskflow/src/routes/dashboard/release-detail/graphs/ReleaseBurnup.tsx
- taskflow/src/routes/dashboard/release-detail/graphs/ReleaseTimeline.tsx
- taskflow/src/routes/dashboard/release-detail/graphs/burnupLabelLayout.ts
- taskflow/src/routes/dashboard/release-detail/graphs/GraphSlot.tsx
- taskflow/src/routes/dashboard/ReleaseDetailPage.tsx (~line 320, burnupEl / timelineSummary)

</canonical_refs>

<decisions_addendum>
## Addendum (2026-11-02, after first plan) — supersedes the header decision above

### Top done bar stays, owns the done figure
- The full-width `ReleaseDoneBar` / `ReleaseIssueGraph fullWidth` under the release header STAYS, and it remains the ONLY "N / M done" figure on the page (Phase 94 rule: no figure shown twice).
- Therefore the shared Progress header shows the COUNTDOWN ONLY (days left / due today / overdue / released / no release date, with existing tones) — NO done/total "issues done" figure. It is shown in both the chart and the thin-history state. Keep it compact (one line).

### Remove the done bar's tooltip
- User: the tooltip duplicates info shown in the content below. Decision: NO tooltip on the top done bar at all — just the segmented bar + "N / M done" figure. Keep the role="img" aria-label on the bar.
- The `statusNames` prop / "Statuses" row becomes dead: remove it from ReleaseIssueGraph, ReleaseDoneBar and the page wiring; remove `statusNameSummary` from useReleaseDetail if it has no other consumer. Update tests.
</decisions_addendum>
