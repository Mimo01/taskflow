# Quick Task 261119-vfy: Simplified Logs timeline - Context

**Gathered:** 2026-11-19
**Status:** Ready for planning

<domain>
## Task Boundary

Rebuild Developer Tools → Logs → Timeline (`taskflow/src/routes/dev-tools/LogsTimeline.tsx` and
friends) as a SIMPLE load waterfall. User verdict on the 261119-tvz timeline: "extremely
complicated and hard to orient in". Shown two richer directions (waterfall with crosshair, trace
tree), the user replied: "both seem very complicated. simplify it and you decide on the
direction".

The approved reference is the mockup at https://claude.ai/code/artifact/d5c2839c-792c-4886-a6bd-07c35a5568b8
(version 2). Its source is copied next to this file as `timeline-mockup.html`. Match it.

Research: `261119-vfy-RESEARCH.md` (audit plus reference tools). Use its section 5 only where it
agrees with the simplified decisions below; the decisions below win.
</domain>

<decisions>
## Locked decisions

### Layout (exactly the mockup)
- One grid for every group header and row: **name | bar | duration** (`minmax(11rem,30%) 1fr 4.5rem`).
- **Groups = page loads**, newest on top. Header (one line, sticky): chevron · page name ·
  "N requests · total time", the tick labels for that load in the bar column (only when open),
  and the wall-clock start time muted on the right. Only the newest load is open by default.
  The user can open or close any load, and that state is kept while switching views/tabs.
- **Rows:** one per request, sorted by start time (ties broken by id). Row height ~26px, one line.
  - Name = a human label: `operation` when present, else a readable short path. Status text
    appears after the name ONLY when not OK: amber 4xx, red 5xx/network error, muted "loading"
    while pending. No method column, no status column, no source badge.
  - Bar: percent-positioned within the load (0 = load start, end = load end), neutral for OK,
    amber 4xx, red error, pending = faint with an outline that grows live (existing useNow
    tick). Queue wait = a faint lead-in segment of the same hue before the bar. No hatching.
  - Faint vertical gridlines at the tick positions.
  - Duration on the right ("412 ms", "1.2 s"; "…" while pending).
- Hover tooltip, 3 rows: the method and path; "Took X after waiting Y ms for a Jira slot"
  (the wait part only if queued); "Started X after the page opened".
- Click a row → selects it and opens the existing LogInspector (unchanged). ↑/↓ moves the
  selection in visual order; Esc clears. Keep the roving-tabstop/focus-ring conventions of ListRow.
- The toolbar's search/filters, Pause and Clear apply to the timeline as before.

### Grouping rule
- A new load starts when the app route changes (the `route` captured at request start differs
  from the previous request's route) OR after >1.5 s with no request in flight. Use
  `queuedAt ?? startedAt` as the start, so a queued request never splits a load.
- Load name: a human page name for the route (reuse the app's existing route/nav labels if a
  mapping exists, e.g. the sidebar items or breadcrumb titles; otherwise title-case the first path
  segment). The issue key or id can follow it, e.g. "Issue PROJ-12".

### Removed (delete code, store fields and tests; no dead code left behind)
- Lane packing, the burst picker, Live, Fit, ⌘/ctrl+wheel zoom, brush, the concurrency strip
  (TimelineConcurrencyStrip), the limit line, the cache lane and marker correlation, the hover
  crosshair, peak/queued header stats, the hatch patterns.
- Query-activity capture (query-activity store, useQueryActivityCapture hook and its mount in
  main.tsx/AppLayout, query-activity diffing) if nothing else uses it after the cache lane goes.
  Also its Clear wiring. Verify with grep before deleting.
- Timeline-only pure helpers that become unused (zoomWindow, brushWindow, packLanes,
  concurrency/queued series, correlation, etc.). Keep groupBursts (renamed/adapted to loads) and
  time ticks if reused.
- dev-tools-view.store timeline fields (timelineWindow, timelineLive, timelineBurstId, …) are
  replaced by a simple `openLoads` (or closed-loads) set.

### Kept
- In-flight capture, `queuedAt` queue-wait handoff, LogInspector, the List view, Pause, filters.

### Performance
- Must stay smooth at 1000 entries. Use @tanstack/react-virtual (already used in the repo) for the
  flattened header+row list if needed. Memoize grouping on entries; only pending rows depend on `now`.

### Claude's Discretion
- Component split and file names; whether to virtualize (measure; 1000 rows of plain divs may be
  fine). Colours from existing theme tokens. Follow user memory: colour = status only, one row = one
  line, calm lists, no legends.
</decisions>
