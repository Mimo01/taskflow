# Quick Task 261001-fmk: Epic detail progress chart - Context

**Gathered:** 2026-10-01
**Status:** Ready for planning

<domain>
## Task Boundary

The Epics list already has a compact quick-peek (`EpicProgressCell` / `EpicPointsCell` in
`taskflow/src/routes/dashboard/EpicProgressCells.tsx`: 3-segment Done/In-Progress/To-Do bar +
`done/total` + `doneSP/totalSP SP`). Add a bigger, more detailed progress/graph section to the
**epic detail** view (the `isEpic` branch of `taskflow/src/routes/dashboard/IssueDetailContent.tsx`,
currently only a Stories list fed by `epicStories` from `fetchEpicStories`).

</domain>

<decisions>
## Implementation Decisions

### Panels (all four selected)
1. **Burnup over time** — line/area chart: cumulative scope (stories by `created`) vs cumulative
   done (stories by `resolutiondate`, done-category only). Shows scope creep + completion trend.
2. **Big status breakdown** — larger version of the list bar, segmented by actual status NAMES
   (e.g. Code Review, QA), coloured by status category, with a legend showing count and SP per status.
3. **Per-assignee breakdown** — horizontal stacked bars per assignee (done / in progress / to do),
   including an "Unassigned" row; sorted by remaining work desc.
4. **Forecast + risk stat tiles** — % done, projected finish date from recent weekly throughput,
   count of unestimated stories (no SP), count of unassigned not-done stories.

### Metric
- Toggle **Count / SP**, default Count. Toggle applies to all charts that have a magnitude
  (burnup, status breakdown, assignee bars, % done / forecast).

### Placement
- Section sits **above the Stories list** in the epic detail (both IssueDetailSheet and
  IssueDetailView paths render IssueDetailContent, so placing it there covers both).

### Claude's Discretion
- Forecast throughput window: last 4 weeks of resolved items (in the active metric); show
  "Not enough data" when throughput is 0 or fewer than ~2 resolved items; no forecast when 100% done.
- Burnup x-axis: from epic created date (or earliest story created) to today, daily or weekly
  buckets depending on span.
- Data source: extend `fetchEpicStories` field list with `created` and `resolutiondate` (same
  request, no extra calls). NO per-story changelog fetches.
- Colours: reuse status category colours (`statusStyles`) for status-category semantics; follow the
  existing recharts wrapper `components/ui/chart.tsx` and `HoursCommitsChart.tsx` patterns.
- Empty epic (0 stories): hide the graph section (Stories list already shows "No stories").
- Loading state: skeleton matching section geometry while `epicStories` is undefined.

</decisions>

<specifics>
## Specific Ideas

- Keep list quick-peek unchanged.
- Pure derivation helpers (burnup series, status buckets, assignee buckets, forecast) should live in a
  testable lib module, separate from rendering.
- Note memory: `fetchEpicStories` is shared by IssueDetailSheet and IssueDetailView — adding fields
  to it is safe (it's additive), but don't change its JQL/order.

</specifics>

<canonical_refs>
## Canonical References

No external specs — requirements fully captured in decisions above.

</canonical_refs>
