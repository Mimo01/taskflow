# Phase 6: Workload + Sprint Progress Enrichment - Context

**Gathered:** 2026-03-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix story point double-counting in the Workload tab (exclude subtasks), add time tracking columns with expandable per-story detail, and enrich the Sprint Progress tab with a stacked status bar (replacing the existing progress bar), sprint-wide time totals, and a per-assignee points-by-status breakdown table. No changes to My Tasks, Sprint Board, or Notifications.

</domain>

<decisions>
## Implementation Decisions

### Workload: table layout
- Full table with column headers: Assignee / Tasks / Pts / Est / Spent / Remaining
- Replaces the current flat inline row layout
- Rows sorted by open task count descending (existing behavior kept)

### Workload: time tracking columns
- Hide Est / Spent / Remaining columns entirely if no issues in the sprint have time tracking data (fields null/zero)
- Do NOT show dashes or a notice — columns simply don't appear when time tracking is admin-disabled
- Consistent with the v1.1 graceful-hide decision

### Workload: per-story expandable rows
- Aggregate row per assignee shows totals (Tasks / Pts / Est / Spent / Remaining)
- Expand arrow reveals per-story rows below the assignee row (story key + name + pts + time columns)
- All assignee rows default to collapsed on load
- Story points field comes from `discoverStoryPointsField()` result cached in settings store (not hardcoded `customfield_10016`)

### Workload: counting scope
- Story points → parent stories only; subtasks are excluded from point totals (WORK-01 fix)
- Time tracking (Est / Spent / Remaining) → aggregate from both stories and their subtasks under the assignee
- Issue count (Tasks column) → non-done issues only, stories only (no subtasks)

### Sprint Progress: stacked bar
- Replaces the existing single-colour progress bar
- Three-segment bar: gray = To Do, blue = In Progress, green = Done (by issue count proportions)
- Inline label below the bar: "27% to do · 20% in progress · 53% done" (muted small text, always visible)
- Bar only shown when sprint has issues (same guard as existing progress bar)

### Sprint Progress: status bucket counts
- Existing To Do / In Progress / Done count rows kept as-is
- Stories only (subtasks excluded from counts)
- Percentages appear in the inline label below the stacked bar, not repeated next to each count row

### Sprint Progress: sprint-wide time totals
- Displayed above the per-assignee table as a summary row: "Sprint Time  Total Est: 80h · Spent: 45h · Remaining: 35h"
- Time totals aggregate from both stories and subtasks in the sprint
- Hidden entirely if no time tracking data exists (same graceful-hide rule as Workload)

### Sprint Progress: per-assignee breakdown table
- Column layout: Assignee / To Do pts / In Progress pts / Done pts
- Points use parent story values only; story status drives which bucket the points fall in
- No time tracking columns in Sprint Progress per-assignee table (Workload tab handles time detail)
- Complements Workload tab: Sprint Progress answers "who's blocked / where are points stuck?"; Workload answers "how loaded is each person?"

### Counting scope summary
- **Story points**: stories only everywhere (subtasks have no points in Jira)
- **Issue counts**: stories only (consistent with points)
- **Time tracking**: stories + subtasks aggregated (time is logged at subtask level)

### Claude's Discretion
- Expand/collapse toggle icon and animation
- Exact time formatting (e.g. "4h 30m" vs "4.5h" — pick what's readable)
- Per-story row indent depth and styling within expandable section
- Stacked bar segment colors (stay in dark/light theme range)

</decisions>

<specifics>
## Specific Ideas

- Workload layout target: `Alice Green    8 tasks  21 pts   Est 16h   Spent 12h   Left 4h` → expand reveals per-story rows
- Sprint Progress stacked bar label target: `[████████████░░░░░░░░░░░░]` then `27% to do · 20% in progress · 53% done`
- Sprint Progress time summary placement: `Sprint Time   Total Est: 80h · Spent: 45h · Remaining: 35h` above per-assignee table

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `WorkloadTab.tsx`: existing `useMemo` row computation — extend `WorkloadRow` interface with time fields; replace flat `div` rows with `<table>` or structured grid
- `SprintProgressTab.tsx`: existing `useMemo` with `ptsDone`/`ptsRemaining`/`hasPoints` — extend to add time totals and per-assignee map
- Both tabs share `['jira-issues', 'sprint-board', activeJiraProject]` query cache — no new fetches needed
- `useSettingsStore` (or equivalent): holds `storyPointsField` key from Phase 5 discovery — read this instead of hardcoded `customfield_10016`
- `shadcn/ui` — available for table, collapse/accordion, or custom expand pattern

### Established Patterns
- `customfield_10016` hardcoded in both tabs → replace with discovered field key from settings store
- Graceful-hide pattern: established in Phase 5 releases context (`fetchFixVersions` returns `data.values ?? []`); apply same approach for time tracking columns
- `issue.fields.status.statusCategory?.key` for bucket logic — already in both tabs, keep as-is
- `issue.fields.issuetype.subtask === true` to identify subtasks (Phase 5 type extension) — use this, not name comparison

### Integration Points
- Both tabs already consume `fetchSprintIssues` result — Phase 5's two-query strategy means the returned array now includes subtask issues; Phase 6 must filter them out for points/counts
- `timetracking` field on `JiraIssue` (Phase 5 type extension): `originalEstimateSeconds`, `timeSpentSeconds`, `remainingEstimateSeconds` — convert to hours for display
- Settings store: read `storyPointsField` (set by `discoverStoryPointsField()` in Phase 5) — fall back to `customfield_10016` if null

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 06-workload-sprint-progress-enrichment*
*Context gathered: 2026-03-12*
