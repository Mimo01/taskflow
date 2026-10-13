# Quick Task 261013-mnc: Enhance AIO cycle detail page and testcase detail UX - Context

**Gathered:** 2026-10-13
**Status:** Ready for planning

<domain>
## Task Boundary

Rework the AIO cycle experience like a professional UI/UX designer: make it more polished, modern, and information-rich.

In scope:
- `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx` (header/overview + both tabs: Executions, Defects)
- `taskflow/src/routes/dashboard/AioTestRunDetailPage.tsx` (test case / run detail)
- `taskflow/src/routes/dashboard/AioCycleDetailSkeleton.tsx` (skeleton should match the new layouts)
- AIO service layer (`taskflow/src/services/aio/`) ONLY to surface extra fields confirmed by live probing
- Associated tests (`AioCycleDetailPage.test.tsx`, `AioTestRunDetailPage.test.tsx`)

Out of scope: AIO Cycles list/dashboard page (just finished in 261013-l97), issue-detail AioTestRunsSection, any write operations to AIO.

</domain>

<decisions>
## Implementation Decisions

### Cycle header & overview
- Header: cycle name + key + cycle status pill + Pin button (keep pin behaviour).
- Metadata line under title: folder, date range, owner, etc. — ONLY fields confirmed by live API probe (see below). Missing fields are omitted, never shown as "—" placeholders in the metadata line.
- Row of 4 KPI tiles: **Pass rate**, **Executed** (n/total), **Failing / Blocked**, **Open defects**. Build on existing `EpicStatCard` + `Card` primitives (StatTile/ChartWrapper were DELETED, a guard test enforces that).
- Taller segmented progress bar below tiles with hover tooltips (≤4 rows) per segment. No legend.

### More info — probe the API
- Researcher probes the live AIO API (raw `/testcycle/{key}/detail`, testcasewithrun/paged, run detail) for unused fields: start/end dates, owner/created by, description/objective, created/updated, environment, etc.
- Planner only surfaces fields that are confirmed present in live responses. Extend `normalizeCycle` / `AioCycle` type accordingly.
- Also derive info from data already fetched (e.g. assignee breakdown, last executed date) where it adds value.

### Executions tab
- Toolbar: search box (filters on test case key + title) + status chips WITH counts: `All 56 · Pass 46 · Fail 3 · Blocked 2 · Not run 5`. Single-select, "All" is the default (replaces the current multi-toggle chips).
- Sortable columns.
- Rows: one-line div+flex rows (NOT table), coloured status rail on the left edge, key + title, status pill, defect count, run count (×N), assignee avatar+name, executed date.
- Row click opens the run detail (keep existing navigation + breadcrumb push).

### Test run detail
- Header shows test case key + title (NOT "Run 123"), status pill, and **Prev / Next with position (4/56)** to step through the cycle's runs in the cycle order.
- Two-column layout: main column + right sidebar.
  - Main: step progress summary ("Steps 3/5 passed" + mini bar), steps as cards (Step / Expected / Actual), failed steps visually highlighted, actual result shown when present.
  - Sidebar: status, assignee, executed date, run count, link back to cycle, defects list (compact).
- Must stack to a single column at narrow widths.

### Defects tab
- Summary strip on top: counts by Jira status category (To Do / In Progress / Done) and by severity.
- Keep the sortable + filterable table behaviour (Status/Priority/Severity/Assignee filters, active chips, clear all) but restyle as one-line flex rows matching Executions.
- "Triggered by" becomes clickable test-case chips that open the corresponding run detail.

### Claude's Discretion
- Exact spacing, typography, icon choices, tile ordering details, empty/loading states, skeleton shapes.
- Whether to extract sub-components into new files (encouraged — AioCycleDetailPage.tsx is 1300 lines).

</decisions>

<specifics>
## Specific Ideas / Project UI rules (from prior UAT feedback — binding)

- Colour = status only. No decorative colours, no legends. Tooltips ≤4 rows.
- One row = one line at every density; drop columns rather than wrap to a second line. Density changes padding/font only (`density-compact:` / `density-comfortable:` variants exist).
- For per-row sizing use div+flex rows: `flex-none` on variable cells, `flex-1 min-w-0` on the expander (title). Table layout makes all rows truncate at the same point.
- `statusPillClass` / `aioRunStatusPillClass` pills need a flex parent — wrap in a flex div, don't add geometry to the span.
- Full-row click + inner link/key button: use an absolute `inset-0` overlay `<button>` as a SIBLING of the inner link, not `div[role=button]` + nested interactive.
- Italic text inside `truncate` gets clipped — add `pr-0.5`.
- Hover affordances must not cause layout shift.
- Shared `<Card>` is `rounded-xl ring-1`, role-less div. Build tiles on `EpicStatCard` + `Card`.
- AIO status map: consumer pages must init it via a query (already done in AioCycleDetailPage via `aioStatusMapQuery`) — the run detail page must not regress this.
- Prev/Next on run detail must derive the run order from the cached `['aio', jiraBaseUrl, 'runs', projectKey, cycleKey]` query (or fetch it) — must work on deep link / pinned tab (no reliance on the cycle page having mounted).
- Biome baseline drifts: gate on "no NEW files flagged", not an absolute count. Pre-commit hook runs full vitest + biome + tsc; RED/GREEN must be combined in one commit.

</specifics>

<canonical_refs>
## Canonical References

- `.planning/quick/261013-l97-*/` — just-completed AIO Cycles dashboard (visual language to match: cards, icons, schedule labels)
- `taskflow/src/services/aio/types.ts`, `taskflow/src/services/aio/cycles.ts` (`normalizeCycle`)
- Phase 51/54/56/58 probe notes under `.planning/phases/` for AIO API shapes

</canonical_refs>
