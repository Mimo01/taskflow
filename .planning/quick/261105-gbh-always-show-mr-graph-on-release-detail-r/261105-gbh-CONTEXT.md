# Quick Task 261105-gbh: always show MR graph on release detail, redo By status as todo/in-progress/done - Context

**Gathered:** 2026-11-05
**Status:** Ready for planning

<domain>
## Task Boundary

Release detail page (taskflow/src/routes/dashboard/ReleaseDetailPage.tsx + release-detail/graphs/).
1. The MR donut must ALWAYS be shown, not only when a GitLab milestone matches. MRs are matched before a
   milestone exists (three-channel union `unionMrs` / `driftRows` in useReleaseDetail.ts already feeds
   `mrDonutCounts`). Today `donutState` returns 'empty' when `gitlabMatch.type === 'none'` and `showDonut`
   requires `hasMilestone`; MrLabels under the graphs is also gated on `showDonut`.
2. The "By status" graph (ReleaseStatusRows) is currently only a fallback for the MR slot. It must ALWAYS
   be shown too, redone.

</domain>

<decisions>
## Implementation Decisions

### MR graph visibility
- Always rendered in its own slot. State derives from the union MR set, not the milestone: empty only when
  the union has no MRs (empty label must not say "in this milestone" — e.g. "No merge requests yet");
  loading/error from the MR channels' fetch state. GitLab not configured → empty state is fine.
- MrLabels row shows whenever the union has MRs (not gated on milestone).
- Remove the "No merge requests in this milestone yet" fallback paragraph (slot is no longer shared).

### By status redesign
- Ring-only donut (reuse AioDonut, same as MR donut) with exactly 3 slices: To do / In progress / Done
  (Jira statusCategory new / indeterminate / done), status colours (colour = status only), total issues
  in centre ("issues" caption, mirroring MR donut's "MRs").
- Tooltip per slice lists the exact Jira status names with counts (≤4 rows per tooltip — collapse the
  rest into "+N more"), per dashboard tooltip preferences.
- No legend. Clicking a slice filtering the table is nice-to-have only if AioDonut already supports it;
  otherwise not required.
- User note: "make sure it looks nice since this type is also used for the MR graph" — the two donuts sit
  next to each other and must read as an identical pair: same size, same ring thickness, same centre
  typography, same GraphSlot heading, vertically aligned. If AioDonut's look needs polish, polish it for
  both (don't fork a second donut component).

### Layout
- Own 5th slot. Wide band: [Burnup][Status][MRs][Type][Assignee] (adjust grid-template columns; the two
  donut columns can be `auto`). Re-check BAND_MIN_WIDTH so 5 columns fit without squeezing the lists.
- Narrow (2x2) grid: place the status donut sensibly (e.g. Status + MRs together in one cell side by side,
  or an extra row) — keep 640px / 440px breakpoints working; no horizontal overflow.
- User (added mid-planning): "make sure it looks good and stacks nicely on different screen sizes".
  Must look deliberate at every width tier: wide band (≥ BAND_MIN_WIDTH), mid 2x2 grid, <640px, <440px
  single column. Donuts stay a matched pair wherever they land; no orphaned half-empty rows or lopsided
  cells. Verify visually at several widths (e.g. 1440, 1180, 900, 600, 400) via a screenshot, not just tests.

### Claude's Discretion
- Whether ReleaseStatusRows is rewritten in place or replaced by a new ReleaseStatusDonut component
  (delete dead code + tests either way; update ReleaseDetailPage tests).
- Exact slice colour classes — reuse existing status-category tokens (RELEASE_SEGMENT_CLASS / NEW_TONE_CLASS).

</decisions>

<specifics>
## Specific Ideas

- Header ReleaseDoneBar already shows the same 3-way split as a bar; donut shape is deliberately different.
- Relevant memories: MR donut is ring-only with labels row UNDER graphs; empty graph slot → compact
  EmptyState with truthful text; dashboard prefs: colour=status only, ≤4-row tooltips, no legends.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above

</canonical_refs>
