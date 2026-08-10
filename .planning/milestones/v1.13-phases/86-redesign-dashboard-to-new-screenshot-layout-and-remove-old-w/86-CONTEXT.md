# Phase 86: Redesign dashboard to new screenshot layout and remove old widgets - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the **entire** current Dashboard (`src/routes/dashboard/index.tsx`) with the 3-region
screenshot layout, and delete every old widget with zero orphaned code.

**New layout (the only thing the Dashboard renders):**
1. **Hero greeting** — time-of-day greeting + first name; subline = full date + sprint position
   ("Monday, 15 June 2026 · Sprint day 4 of 10"). Greeting varies by local time; sprint line
   hides/degrades when there is no active sprint.
2. **Top row — two cards side by side:**
   - **MY ISSUES** (left, scope = this sprint, personal): big number "{done} of {total} done",
     segmented horizontal bar To Do / In Progress / Done, legend with counts.
   - **UPCOMING RELEASES** (right): horizontal timeline, up to 3 milestone dots, each with name,
     relative due, a thin readiness bar, and "{n}% ready".
3. **Bottom — full-width chart card "PAST 7 DAYS · HOURS & COMMITS PER DAY":** per-day grouped bars
   (blue = hours logged, green = commits), header-right totals, today highlighted, dashed gridline
   at max, 0-value days render flat with "0h"/"0" labels.

**Hard constraints (from 86-DESIGN-INTENT.md):**
- **No new API surface.** All data from sources already wired in (sprint issues, Jira versions,
  Tempo worklogs, GitLab commits). Reuse existing queries/cache keys.
- **Remove the old dashboard.** Delete the Phase 83–85 widgets (components, hooks, query helpers,
  tests, unused chart wrappers). `npm run check` stays GREEN; no unreferenced exports.
- **Edge cases are in scope:** empty/zero states, missing release dates, no active sprint, days with
  0 hours / 0 commits, partial weeks.

WHAT this phase delivers is fixed by the screenshots + DESIGN-INTENT. This discussion captured the
HOW decisions and the removal scope. No new capabilities.

</domain>

<decisions>
## Implementation Decisions

### Removal Scope
- **D-01:** **Full clean slate.** Remove ALL current Dashboard widgets — not just Phases 83–84
  (stat tiles, Sprint Health, Weekly Trend, Activity Strip, Release card) but ALSO **Phase 85's
  Velocity + Burndown charts**, even though they shipped 2026-06-15. The redesigned Dashboard renders
  exactly the 3 screenshot regions and nothing below them. Velocity/Burndown are removed from the
  Dashboard surface (the underlying `fetchClosedSprints`/GreenHopper service code may be deleted too
  if it has no other consumer — planner verifies via reference search before deleting shared helpers).
  - ⚠ Note for planner: this reverses the "append at the bottom" placement decided in Phase 85 (85
    D-Discretion / [[project_phase84_dash06_descoped]] lineage). The milestone PROJECT.md listed
    "personal velocity trend" as a target — that capability is being retired from this redesign by
    explicit user direction. If velocity is wanted back later it returns as its own phase.

### My Issues Card
- **D-02:** **Issue count everywhere** (reverses an initial SP lean — the screenshot's "8 of 13" +
  "To Do 3 · In Progress 2 · Done 8" are issue counts that sum cleanly). Big number = count of my
  DONE issues / count of my total sprint issues; bar segments + legend are issue counts. NOT story
  points.
- **D-03:** **Bucket by `statusCategory`** — every workflow status collapses into To Do / In Progress
  / Done via `status.statusCategory.key` (`'new'` → To Do, `'indeterminate'` → In Progress, `'done'`
  → Done). No manual per-status mapping. Segments MUST sum to the total (invariant to assert in a test).
- **D-04:** **Personal scope, this sprint.** Filter active-sprint issues to me via the established
  `assignee.displayName === jiraUserDisplayName` pattern; exclude subtasks (`!issuetype.subtask`),
  consistent with the lifted Phase 83 filters.
- **D-05:** **Edge — 0 issues → empty state** (not an error). Reuse the existing sprint-board query
  cache key so this card adds zero network calls.

### Upcoming Releases Timeline
- **D-06:** **Next 3 unreleased versions that HAVE a `releaseDate`,** sorted soonest-first. Versions
  with no due date are **excluded** from the timeline (keeps the relative-due labels meaningful).
- **D-07:** **"% ready" = existing `donePct` logic from `DashboardReleaseCard`** — `doneCount /
  totalCount` where done = `status.statusCategory.key === 'done'`, by **issue count** (consistent with
  D-02). Reuse `fetchReleaseIssues` + the `['jira-fix-versions', activeJiraProject]` cache key; extend
  the current single-soonest card into an up-to-3-dot timeline. Do NOT add an API.
- **D-08:** **Edges:** fewer than 3 upcoming releases → render only what exists; 0% / 100% ready render
  honestly; relative-due labels reuse `getReleaseTimingLabel` ("Tomorrow", "in 8 days", "overdue").

### 7-Day Hours & Commits Chart
- **D-09:** **Rolling 7 calendar days ending today** (Tue…Mon per screenshot) — NOT the current
  Mon–Fri week. Weekday X labels; today highlighted (pill on the last bar).
- **D-10:** **Dual Y-axis, grouped bars.** Hours on the left axis (blue), commits on the right axis
  (green), rendered side-by-side per day — because hours (~8–12) and commits (22+) live on different
  scales and a shared axis would distort. Header-right totals: "{h} h logged" (blue) · "{n} commits"
  (green). Dashed gridline at the max.
- **D-11:** **Data sources (no new API):** hours per day from Tempo worklogs via `fetchWorklogs`
  (bucket on `tempo.started.slice(0,10)` local-date — NO `toISOString()` UTC shift, per
  [[project_fetch_once_pagecap_pitfall]] sibling lesson on date bucketing); commits per day from
  GitLab via `fetchUserCommits` (`/repository/commits` with since/until), the same source
  `ActivityStrip` uses. Planner confirms a warm-cache key can be reused or a new bounded query is added
  WITHOUT a new endpoint.
- **D-12:** **Edges:** all-zero week renders flat bars with "0h"/"0" labels; today partial is fine;
  weekend with no activity = flat 0 bars (not omitted). Tempo-off → graceful empty state, never an
  error (lift `WeeklyTrendChart`'s `isEmpty={!tempoEnabled}` pattern).

### Hero Greeting
- **D-13:** Reuse the existing greeting + first-name logic in `index.tsx` (already handles
  on-prem displayName formats). Add the **sprint-position subline** ("Sprint day 4 of 10") derived
  from the active sprint's `startDate`/`endDate` vs today; **hide the sprint clause** when there is no
  active sprint (date still shows).

### Charting Stack (locked by Phase 81 — do not re-litigate)
- **D-14:** Recharts v3 via `ChartWrapper` + shadcn `chart` primitive; `responsive` prop (never
  `ResponsiveContainer`); explicit-height outer div (WebKit 0×0 guard); `isAnimationActive={false}`;
  `var(--chart-N)` CSS-var colors; per-section `Skeleton`/`ErrorState`/`EmptyState`.

### Claude's Discretion
- Exact component decomposition (one `Dashboard` file vs extracted `MyIssuesCard` /
  `UpcomingReleasesTimeline` / `HoursCommitsChart` components) — favor small focused components.
- Precise visual polish (segment colors, dot styling, label typography) — match the screenshots; the
  planner/ui-researcher owns the visual contract. **Re-attach the original screenshots when planning**
  (`/gsd-ui-phase 86` or ui-researcher).
- Whether removed Phase 85 service helpers (`fetchClosedSprints`, `fetchSprintIssuesBySprintId`,
  GreenHopper rapid-charts call) are deleted or retained — delete iff no other consumer (reference
  search first).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase intent & requirements (the acceptance bar)
- `.planning/phases/86-redesign-dashboard-to-new-screenshot-layout-and-remove-old-w/86-DESIGN-INTENT.md`
  — verbatim user directive, hard constraints, target layout per region, data-source mapping,
  cleanup checklist, screenshot description. **Read first.**
- `.planning/ROADMAP.md` §Phase 86 (lines ~533–541) — phase entry (goal TBD → planner derives from
  DESIGN-INTENT).

### Dashboard root + widgets to REMOVE
- `taskflow/src/routes/dashboard/index.tsx` — the Dashboard being rewritten. Currently composes
  StatTile ×4, `SprintHealthSection`, `WeeklyTrendChart`, `ActivityStrip`, `DashboardReleaseCard`,
  `VelocityChart`, `BurndownChart` — ALL removed (D-01).
- Files to delete (planner enumerates exact set + their tests/hooks):
  `taskflow/src/routes/dashboard/StatTile.tsx`, `SprintHealthSection.tsx`, `WeeklyTrendChart.tsx`,
  `ActivityStrip.tsx`, `DashboardReleaseCard.tsx`, `VelocityChart.tsx`, `BurndownChart.tsx`, and
  `dashboardMetrics.ts` helpers that become unused.
- `taskflow/src/routes/dashboard/widget-removal.guard.test.ts` — **existing deletion-guard pattern**
  (`fs.existsSync(...) === false` + "index.tsx does not import X"). Extend it with the Phase 86
  removals (REMOVE-02 lineage) to enforce zero dead code.

### Data sources to REUSE (no new API — D-11, D-07, D-04)
- `taskflow/src/routes/dashboard/DashboardReleaseCard.tsx` — `donePct = doneCount/totalCount` by
  `statusCategory==='done'`; `fetchFixVersions` + `fetchReleaseIssues`; `['jira-fix-versions',
  activeJiraProject]` cache key; `getReleaseTimingLabel`. Lift + extend single-soonest → 3-dot timeline.
- `taskflow/src/routes/dashboard/WeeklyTrendChart.tsx` — Tempo `fetchWorklogs` usage, local-date
  bucketing, `isEmpty={!tempoEnabled}` empty-state pattern; `dashboardMetrics.ts` (`buildWeekBuckets`,
  `formatHoursMinutes`, `DAILY_TARGET_HOURS`). Adapt Mon–Fri → rolling-7-day window (D-09).
- `taskflow/src/routes/dashboard/ActivityStrip.tsx` — `fetchUserCommits` from `@/services/gitlab` (the
  per-day commit source for D-11) + its warm-cache key.
- `taskflow/src/services/gitlab.ts` — `fetchUserCommits` (`/api/v4/projects/:id/repository/commits`
  with since/until, paginated). Commits-per-day source; do NOT add a new endpoint.
- `taskflow/src/services/tempo/worklogs.ts` — `fetchWorklogs` (hours source).
- `taskflow/src/services/jira.ts` — `fetchSprintIssues` (My Issues source), `fetchActiveSprint`
  (sprint start/end for the hero sprint-day line, D-13), `fetchFixVersions`/`fetchReleaseIssues`.

### Patterns (locked — do not re-litigate)
- `.planning/phases/85-sprint-insights-conditional-probe-gated/85-CONTEXT.md` — independent-degradation
  pattern; the Velocity/Burndown being removed here.
- `.planning/phases/83-dashboard-stat-tiles-and-sprint-health-chart/83-CONTEXT.md` — D-04 (`!subtask`
  filter + test), D-05 (`assignee.displayName` personal filter), D-11 (per-section degradation).
- `.planning/phases/81-charting-foundation/81-CONTEXT.md` — Recharts v3 + `ChartWrapper` charting
  contract (D-14).

### Charting assets
- `taskflow/src/components/chart-wrapper.tsx` + `taskflow/src/components/ui/chart.tsx` — `ChartWrapper`
  status-prop API (isLoading/error/isEmpty + explicit height).
- `taskflow/src/index.css` — `--chart-1..5` OKLCH tokens (both themes) for bar colors.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `index.tsx` greeting + first-name parser (on-prem displayName formats) — keep for the hero (D-13).
- `DashboardReleaseCard` `donePct` + timing-label logic — the readiness math is already written; just
  render up to 3 instead of 1 (D-06/D-07).
- `WeeklyTrendChart` Tempo fetch + local-date bucketing + tempo-off empty state — adapt to 7-day window.
- `fetchUserCommits` (ActivityStrip) — commit data already fetched; bucket per day for the green series.
- `ChartWrapper` + `--chart-N` tokens — no per-chart loading/error boilerplate, no theme code.
- `widget-removal.guard.test.ts` — the established absence-guard test to extend for D-01 cleanup.

### Established Patterns
- Warm-cache reuse via shared TanStack Query keys (sprint board, fix versions, commits) — adding cards
  that reuse the same keys adds zero network calls.
- Per-section independent degradation (DASH-07, since Phase 82) — each region owns its loading/error/
  empty state; one failure never blanks the Dashboard.
- Local-calendar date bucketing (`toLocaleDateString('en-CA')` / `.slice(0,10)`), NOT `toISOString()`
  UTC shift — applies to both the sprint-day count and the 7-day buckets.

### Integration Points
- `src/routes/dashboard/index.tsx` is fully rewritten to the 3-region layout; likely extract
  `MyIssuesCard`, `UpcomingReleasesTimeline`, `HoursCommitsChart` components under
  `src/routes/dashboard/`.
- `Sidebar.tsx` references `SprintHealthSection` (a prefetch) — planner checks for cross-references
  before deleting shared queries (the active-sprint prefetch may need to stay or be repointed).

</code_context>

<specifics>
## Specific Ideas

- The screenshot is the visual contract — **re-attach both original screenshots when planning**
  (`/gsd-ui-phase 86`). DESIGN-INTENT describes them but the planner/ui-researcher should see them.
- My Issues segments MUST sum to the total — write a unit test asserting `toDo + inProgress + done ===
  total` after statusCategory bucketing (D-03).
- Dual-axis is deliberate (D-10): a shared axis makes 22 commits dwarf 8 hours. Label both axes.
- Sprint-day line ("day 4 of 10") = days elapsed since `startDate` / total sprint length; degrade the
  clause entirely when no active sprint (D-13).
- Zero-state honesty: 0-hour / 0-commit days render flat bars WITH "0h"/"0" labels, not omitted (D-12).
- "Zero dead code" is verified two ways: extend `widget-removal.guard.test.ts` AND keep `npm run check`
  GREEN (no unreferenced exports — [[project_biome_state]]).

</specifics>

<deferred>
## Deferred Ideas

- **Personal velocity trend chart** — explicitly removed from the Dashboard by D-01. If wanted back, it
  returns as its own phase (it shipped in Phase 85 and can be revived from git history).
- **Sprint burndown chart** — same: removed from the Dashboard surface; revive as its own phase if
  desired.
- **Configurable 7-day window / N-day range** — fixed at 7 (D-09); lift to a setting later if asked.
- **Releases with no due date on the timeline** — excluded for now (D-06); a future variant could park
  them at the timeline end.

None other — discussion stayed within phase scope.

</deferred>

---

*Phase: 86-redesign-dashboard-to-new-screenshot-layout-and-remove-old-w*
*Context gathered: 2026-06-15*
