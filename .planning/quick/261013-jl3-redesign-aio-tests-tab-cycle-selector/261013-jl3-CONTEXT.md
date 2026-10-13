# Quick Task 261013-jl3: Redesign AIO Cycles page (folder/cycle selector + cycle list) - Context

**Gathered:** 2026-10-13
**Status:** Ready for planning

<domain>
## Task Boundary

User request: "Enhance AIO tests tab with the selector of cycles. It works correctly now, but it looks and feels odd. Look at it from a professional point of view and deliver the best UI/UX you can. Keep it consistent with the rest of the app. You can put more information there if you have it from Jira. Do your research what to put there and how to get the data."

Target confirmed: the **AIO Cycles** page — `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx` (route `/aio-project/:projectKey`, sidebar item "AIO Cycles"). Left panel = folder tree (cycle selector), right panel = cycle table.

Behaviour that must keep working: folder selection persistence (`useAioCyclesSelectionStore`), server-side folder filter incl. descendants, Ungrouped (-1) bucket, `initializeAioStatusMap` init, breadcrumb push on navigation to `/aio-cycle/:projectKey/:cycleKey`, density variants (`density-compact:` / `density-comfortable:`), existing data-testids used by `AioProjectOverviewPage.test.tsx` (update tests where behaviour intentionally changes).

</domain>

<decisions>
## Implementation Decisions

### Selector (left panel)
- Keep the left folder-tree panel, but polish it:
  - filter/search box for folders,
  - subtle selected state (NOT the solid `bg-primary` fill) consistent with other side panels / sidebar in the app,
  - folder icons,
  - aggregate counts (folder count includes descendants),
  - an "All cycles" root entry,
  - match visual language of the other side panels in the app.

### Cycle list columns (all from data the AIO API already returns)
- Open/Closed status badge (`detail.isClosed`).
- Start–end dates; flag open cycles past their end date as overdue.
- Pass rate % next to the segmented progress bar; the bar gets a hover tooltip (≤4 rows) instead of the "3P 1F" letter legend.
- Effort: estimated vs actual (`summary.estimatedEffort` / `summary.actualEffort`).

### Closed cycles (revised after research — a "Show closed" Switch was removed by the user in 99800f30)
- NO Switch. Use a segmented "Open | All" status filter in the cycle-list toolbar; default "Open"; remembered (persisted in aio-cycles-selection store, field e.g. `showClosed`/`statusFilter`).
- When the selected folder has cycles but ALL are closed and filter = Open, do NOT show a bare empty list: show a notice "All N cycles in this folder are closed" with a one-click "Show them" action that switches to All.
- In "All" mode, closed cycles sort after open ones and render muted with a Closed status pill.

### Row interaction
- Whole row clickable (overlay-button pattern: absolute inset-0 button as a SIBLING of other interactive elements, per project memory); key text stays selectable/copyable.

### Claude's Discretion
- Exact layout, typography, column widths, header/toolbar design, empty/loading states, sort order, any count summary in the header.
</decisions>

<specifics>
## Specific Ideas / Project UI rules (from memory — must follow)
- Colour = status only; tooltips ≤4 rows; no legends; identical card/row styling across views.
- One row = one line at every density; drop columns rather than wrapping to a second line; density changes padding/font only.
- Use div+flex rows (flex-none variable cells, flex-1 min-w-0 expander) rather than a <table> if per-row truncation matters.
- Overlay button for full-row click (sibling, not nested).
- Hover affordances must not cause layout shift.
- Italic text inside `truncate` needs `pr-0.5`.
- statusPillClass needs a flex parent.
- Shared `<Card>` primitive gotchas (ring-1, token padding).
- Biome lint + full vitest run on pre-commit; combine RED/GREEN in one commit.
</specifics>

<canonical_refs>
## Canonical References
- `.planning/milestones/v1.8-phases/57-redesign-the-aio-cycles-page-it-should-be-more-like-the-real/` — original Phase 57 CONTEXT, UI-SPEC, API-EXAMPLES.md (paged + summary/paged response shapes)
- `taskflow/src/services/aio/types.ts` — AioCycleDetailItem, AioCycleSummaryItem, AioTestRunStatusConfig
</canonical_refs>
