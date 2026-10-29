# Quick Task 261029-oyw: Optimize release detail page for smaller screens - Context

**Gathered:** 2026-10-29
**Status:** Ready for planning

<domain>
## Task Boundary

Optimize the Release detail page (`taskflow/src/routes/dashboard/ReleaseDetailPage.tsx` + `release-detail/`) for smaller screens and for when the task peek sidebar is open (which narrows the page). Currently the page "doesn't really work" at narrow widths: the main column holds UnifiedTaskTable whose rows use fixed-width columns (COL_KEY 5.5rem, COL_PERSON 8.75rem, COL_STATE 6rem, COL_MR 11.875rem, several 1.75rem flag cells) while a resizable right sidebar (useResizable width) takes a fixed chunk — the summary column gets crushed.

Take inspiration from the recent responsive fixes on other pages:
- quick-261028-n6b (My Tasks responsive rows): commits 780aa6b7, 76c67851 — container-query tiers on MyTaskRow.tsx (hide SP/labels, shrink time bar, icon-only chips with sr-only text + aria-label/title below a container width, overflow-hidden safety net)
- quick-261028-m3b (AIO defects list responsive columns): commit 924e7027 — DefectsList.tsx shows priority icon + assignee avatar at narrowest

</domain>

<decisions>
## Implementation Decisions

### Sidebar
- Keep sidebar SIDE-BY-SIDE at all widths (do NOT stack it below, do NOT add a collapse toggle).
- At narrow widths it shrinks: clamp the sidebar's effective width narrower (e.g. cap as a fraction of the container / lower max) so the main column keeps usable room. Sidebar content must still fit/truncate sensibly at the narrower width.

### Table columns
- User wants BOTH compaction AND dropping: tiered container-query degradation.
  - Compact first (e.g. assignee → avatar only, MR column narrower / icon-only, state pill tighter).
  - Then drop lower-priority columns at the narrowest tiers.
- Summary keeps priority; one row = one line at every width (no second line, no wrapping).

### Claude's Discretion
- Exact breakpoint thresholds and which column drops first (base on content; mirror My Tasks/DefectsList tier conventions).
- Treatment of the page header, label summary, deployment package section, and action buttons at narrow widths.
- Accessible names (title/aria-label) preserved when text becomes icon-only.

</decisions>

<specifics>
## Specific Ideas

- Use Tailwind v4 container queries on an INNER wrapper (memory: @container variants never style the container itself).
- Rows are div+flex (not table) — keep flex-none on fixed cells, flex-1 min-w-0 on summary.
- Respect memory gotchas: statusPillClass needs a flex parent; italic text + truncate needs pr-0.5; WebKit/Tauri 0-width column issue on narrow cols (use explicit sizing); no layout shift from hover affordances.
- Secondary table (MRs not covered by a task) should follow the same tiers.

</specifics>

<canonical_refs>
## Canonical References

- taskflow/src/routes/my-tasks/MyTaskRow.tsx (container-query tier pattern)
- taskflow/src/routes/dashboard/aio-cycle/DefectsList.tsx (narrow-column pattern)
- .planning/quick/*261028-n6b*/ and *261028-m3b*/ plans/summaries

</canonical_refs>
