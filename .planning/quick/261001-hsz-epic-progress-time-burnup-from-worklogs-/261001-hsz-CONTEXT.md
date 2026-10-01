# Quick Task 261001-hsz: Epic progress — worklog-based time burnup, estimate formula, tooltips, layout - Context

**Gathered:** 2026-10-01
**Status:** Ready for planning

<domain>
## Task Boundary

Third iteration on the epic detail progress section (prior: 261001-fmk, 261001-g5q — both on main).
Files: `taskflow/src/routes/dashboard/issue-detail/EpicProgressSection.tsx`, `taskflow/src/lib/epic-progress.ts`,
`taskflow/src/services/jira.ts` (`fetchEpicStories`, worklog helpers ~line 428 `fetchAllWorklogPages`, ~1653),
`taskflow/src/components/ui/tooltip.tsx`, `taskflow/src/routes/dashboard/IssueDetailContent.tsx` (Stories list),
`taskflow/src/routes/dashboard/EpicProgressCells.tsx` (Epics list quick peek — NOW in scope for tooltip only).

User UAT feedback on 261001-g5q:
1. "I meant tooltips on the progress bars"
2. "Separation is still too squished and card takes unnecessary horizontal space, do something different"
3. "The time logged is not shown on the graph. Progress is not counted with just the done time, but also intermediate
   daily logs, and when a story is done all the estimate is collapsed into the logged (think about how to count this harder)."
4. "Reevaluate how estimated time is counted for the story, add tooltip explaining the formula. Also add estimate into the time [graph]."

</domain>

<decisions>
## Implementation Decisions

### Estimate formula (user choice: "Subtasks if any, else story")
- Per story: `estimate = (sum of subtasks' original estimates) if the story has ≥1 subtask with an estimate > 0, else story's own original estimate`.
  - Derive subtask sum WITHOUT extra calls as `aggregatetimeoriginalestimate − timeoriginalestimate` (add `timeoriginalestimate`
    to fetchEpicStories fields), OR from the subtask search below (Time mode) — planner picks; must be consistent between tiles, bars and burnup.
  - Logged per story = story's own + subtasks' logged (aggregatetimespent is correct for logged — no double counting).
- Applies everywhere Time weights are used (tiles, status bar, assignee bars, burnup).
- Tooltip on the Estimated tile (and the estimate burnup series/legend) explains the formula in plain words,
  e.g. "Per story: sum of its subtask estimates; stories without estimated subtasks use their own estimate."

### Time burnup model (user choice: proposed model)
- Two series in Time mode: **Estimate** and **Logged** (replace scope/done naming for Time mode; Count/SP burnup unchanged).
- **Logged** = cumulative worklog time per day, from worklogs on stories AND their subtasks (by worklog `started` date, date-key via `.slice(0,10)`, clamp to today).
- **Estimate** per day = Σ over stories that exist by that day (created ≤ day):
  - story not done as of that day → `max(estimate, logged-so-far on that story incl. subtasks)`
  - story done as of that day (done date from existing fallback chain) → its logged-so-far (estimate "collapses into logged").
  - So gap between Estimate and Logged = remaining work; for done stories the gap closes; overruns raise the estimate line.
- Tiles in Time mode: Estimated (formula above, current), Logged, Remaining (= Σ open stories max(estimate − logged, 0); replaces Jira
  aggregatetimeestimate so tiles agree with the chart — note this in the tooltip), % logged.
- Data: worklogs fetched LAZILY only when Time mode is selected (separate react-query keyed by epic key; does not block Count/SP).
  Approach to research/confirm: Jira search with `fields=worklog,…` embeds up to 20 worklogs per issue (`worklog.total` > `maxResults` → top up
  via `/rest/api/2/issue/{key}/worklog` using the existing `fetchAllWorklogPages` helper). Two searches: stories (`"Epic Link" = KEY`) and
  subtasks (`parent in (story keys)`, chunked for long key lists). No per-issue calls unless truncated. Loading state for the chart while
  worklogs load; error → show retry, keep tiles from aggregate fields.
- Respect memory: fetch-once page-cap pitfall — paginate fully (use fetchAllSearchPages); shared fetcher cache key — new fetcher, own key.

### Tooltips on progress bars (user selected all four)
1. **Burnup chart**: richer hover — crosshair cursor, tooltip with date (with year) and all series values metric-formatted; in Time mode also show remaining (estimate − logged).
2. **Epics list quick-peek bar** (`EpicProgressCell` in EpicProgressCells.tsx): replace native `title` with the shared Tooltip (Done/In Progress/To Do counts + SP). Keep its existing tests green; it is purely presentational — don't change its states/retry.
3. **Status + assignee bars in detail**: already wired via base-ui Tooltip with `render={<div />}` segments, but the user reports they don't show in the app. INVESTIGATE why (e.g. pointer events on tiny/flex children, overflow-hidden clipping, base-ui trigger needing a focusable element, WKWebView quirks) and fix so hovering ANY part of the bar shows a tooltip. Prefer one tooltip per whole bar (trigger = the bar container, content = full per-segment breakdown) over per-segment triggers if more robust.
4. **Stories list rows in detail** (IssueDetailContent.tsx Stories list): add a compact per-story mini bar (logged vs estimate, using the same formula; overrun shown distinctly) with tooltip (estimate, logged, remaining, formula note). Respect one-row-one-line, statusPillClass needs flex parent, overlay-button pattern memory if needed (row is a <button>; avoid nested interactive — tooltip trigger inside the row must not be a button; hover-only div trigger is fine).

### Separation / layout (Claude's discretion — user: "do something different", card wastes horizontal space)
- Remove the Card container. Section spans the full content width with NO horizontal inset.
- Separate with a full-width top divider (border-t) + bottom divider (border-b) and generous vertical padding/margins (≈ py-5/my-6),
  plus more internal vertical rhythm between panels (≈ space-y-5). Header row: "Progress" title + metric toggle.
- Tiles: flat style without per-tile rings is acceptable if it reads cleaner; use full width (4 across on normal widths).
- Skeleton must match the new geometry.

### Constraints carried over
- Existing tests must keep passing (`EpicDetailSheet.test.tsx`: avoid standalone "Stories"/"In Progress"/"Done" text collisions;
  EpicProgressCells tests; prior epic-progress tests — update intentionally-changed expectations only, and say so).
- Pre-commit hook: biome + tsc (incl. tests; no Array.prototype.at) + full vitest. Tests+impl in one commit per task. Never --no-verify.
- One row = one line at every density. Italic in truncate needs pr-0.5.

</decisions>

<canonical_refs>
## Canonical References

- .planning/quick/261001-fmk-epic-detail-progress-chart/ (original plan/research/review)
- .planning/quick/261001-g5q-epic-progress-time-metric-card-container/ (time metric, tooltips, review)
- taskflow/src/routes/dashboard/issue-detail/TimeTrackingSummary.tsx (aggregate fields usage)

</canonical_refs>
