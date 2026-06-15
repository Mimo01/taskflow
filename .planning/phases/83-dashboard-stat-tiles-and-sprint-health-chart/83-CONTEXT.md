# Phase 83: Dashboard Stat Tiles and Sprint Health Chart - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the Dashboard's 3-card grid (`DashboardSprintCard`, `DashboardInProgressCard`, and the standalone `DashboardReleaseCard`) with **personal stat tiles** plus a **sprint-health section** (sprint days remaining + overall %-progress + a points-by-status donut). Everything is derived from the already-warm `['jira-issues','sprint-board',activeJiraProject,storyPointsFieldKey]` cache — **zero new API calls on Dashboard load**. Retain the gradient hero greeting + en-GB date and the next-release countdown. Remove the temporary `SmokeTestChart` scaffold from Phase 81.

WHAT this phase delivers is locked by ROADMAP §Phase 83's 4 success criteria and requirements DASH-01, DASH-02, DASH-03, DASH-07. This discussion captures only the HOW/UX decisions left open inside that scope. No new capabilities — new ideas go to other phases.

</domain>

<decisions>
## Implementation Decisions

### Layout Replacement (DASH-01)
- **D-01:** Remove the three dashboard cards (`DashboardSprintCard`, `DashboardInProgressCard`, `DashboardReleaseCard` as a standalone card) **and** the `SmokeTestChart` scaffold. **Retain** the gradient hero greeting + en-GB date (the `<section>` with ambient curves) and the next-release countdown. The next-release countdown is retained — reuse `DashboardReleaseCard`'s fix-versions logic, but it is no longer one of "the 3 cards" being removed; it lives on as the release/countdown element (exact placement is Claude's discretion).

### Stat Tiles — Scope & Definitions (DASH-02)
- **D-02:** **Four tiles: Open, In Progress, Overdue, SP Done this sprint.** The first three are **personal** (filtered to the current user's assigned issues in the active sprint); **SP Done this sprint is whole-sprint velocity** (all done story points in the sprint, not just mine). This reconciles the ROADMAP "personal stat tiles" wording with a useful team-velocity signal.
- **D-03:** Tile definitions (all over the warm sprint-board cache):
  - **Open** = my assigned issues with `status.statusCategory.key !== 'done'`.
  - **In Progress** = my assigned issues with `status.statusCategory.key === 'indeterminate'` (in-progress category).
  - **Overdue** = my assigned issues with a due date earlier than today AND not done.
  - **SP Done this sprint** = sum of story points of done stories across the **whole sprint**, **excluding subtasks** from the SP sum.
- **D-04:** **SP sums exclude subtasks** everywhere (criterion 2). The mandated unit test: a fixture of parent(5 SP) + 2 subtasks(2 SP each) must assert the SP total = **5, not 9**. Reuse the established `!i.fields.issuetype.subtask` filter (as in `DashboardSprintCard`).
- **D-05:** **Current-user matching = assignee `displayName` comparison** against `jiraUserDisplayName` from `auth.store` — the existing pattern locked in `DashboardInProgressCard` (its D-08, "Option B: displayName comparison, no type cast"). Consider `lib/assignee-filter.ts` helpers if a cleaner predicate exists, but do not introduce accountId plumbing this phase.

### Stat Tiles — Interaction (DASH-02)
- **D-06:** **Tiles are static display only — no drill-down.** Rationale: the shipped My Tasks page (Phase 82) has only 3 filter buckets (To Do / In Progress / Done), no Overdue bucket, and no URL/nav param to pre-apply a filter. Deep-linking would require new wiring on the Phase 82 page and still leave Overdue/SP-Done with no matching destination. Keeping tiles static keeps Phase 83 purely additive to the Dashboard. (Drill-down can be revisited later — see Deferred.)

### Points-by-Status Chart (DASH-03)
- **D-07:** **Donut chart, segmented by `statusCategory`** → 3 segments: To Do / In Progress / Done. Maps cleanly to 3 semantic `--chart-N` CSS-var aliases (no hardcoded hex — criterion 3). Built via `ChartWrapper` + the shadcn `chart` primitive.
- **D-08:** Donut segments are **points-weighted** (story points per category, subtasks excluded — consistent with D-04), **not** issue counts. The donut center may show **total sprint SP** (exact center content is Claude's discretion).

### Sprint Health Section (DASH-03)
- **D-09:** Section contains **sprint days remaining + an overall %-complete progress bar (done SP / total SP, whole sprint) + the points-by-status donut**, together. Reuse `DashboardSprintCard`'s existing days-remaining (`getDaysRemaining` from `activeSprint.endDate`) and %-progress (donePoints / totalPoints, division-by-zero guarded) logic.

### Data Sourcing & Independence (DASH-03, DASH-07)
- **D-10:** All tile + chart figures derive from the **warm `['jira-issues','sprint-board',activeJiraProject,storyPointsFieldKey]` cache** via `fetchSprintIssues` — **no new network request fires when the Dashboard loads** (criterion 3). ⚠ **Open item for research/planning:** sprint days-remaining needs the active-sprint `endDate`, which the old card got from a *separate* `fetchActiveSprint` query (`['jira-active-sprint',...]`), not from `fetchSprintIssues`. Planner must confirm days-remaining is sourced from an already-warm cache (or derivable from the sprint-board payload) so criterion 3's "zero new API calls" holds. If `fetchActiveSprint` is reliably warm (visited Sprint Board / prior load), reusing its cache key is acceptable; otherwise find the endDate within the warm sprint-board data.
- **D-11:** **Every section has its own `Skeleton` / `ErrorState` / `EmptyState`** and degrades independently — a slow or failed section must not blank adjacent sections (DASH-07, criterion 4). Reuse the shared `components/ui/` state primitives, following the Phase 82 D-11 pattern.

### Claude's Discretion
- Tile layout/grid (count per row, responsive breakpoints) and tile visual treatment.
- Exact donut center content (total SP vs nothing) within D-08.
- Progress-bar styling and where days-remaining sits relative to the donut within the sprint-health section (D-09).
- Exact placement of the retained next-release countdown within the new layout (D-01).
- Component decomposition: a new `StatTile` component + a `SprintHealthSection`, vs. inline — planner/researcher choice. Reuse/adapt over net-new where sensible.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — DASH-01, DASH-02, DASH-03, DASH-07 (lines 35–41) — the binding requirement list. NOTE: DASH-02 in REQUIREMENTS lists "MRs awaiting my review, hours logged this week" — those are **Phase 84** (DASH-04/06); Phase 83 tiles are Open / In Progress / Overdue / SP Done only, per the ROADMAP §83 success criteria.
- `.planning/ROADMAP.md` §Phase 83 (lines 431–444) — goal + 4 success criteria (the acceptance bar; criterion 2 mandates the subtask-exclusion SP unit test, criterion 3 mandates zero new API calls + CSS-var status colors, criterion 4 mandates independent section degradation)

### Charting stack (locked by Phase 81 — do not re-litigate)
- `.planning/phases/81-charting-foundation/81-CONTEXT.md` — D-01..D-08: Recharts v3 + shadcn `chart` primitive, `responsive` prop (never `ResponsiveContainer`), explicit-height outer div (WebKit 0×0 guard), `isAnimationActive={false}`, `var(--chart-N)` CSS-var colors, `ChartWrapper` status-prop card API
- `.planning/research/STACK.md` — charting library decision + versions
- `.planning/research/PITFALLS.md` §1–3 — 0×0 collapse, React Compiler, theme/color tokens

### Prior phase patterns
- `.planning/phases/82-my-tasks-page/82-CONTEXT.md` — D-11 per-section state-primitive + independent-degradation pattern (DASH-07 applied early); also the source of the "My Tasks has only 3 filter buckets, no deep-link param" reality behind D-06

### Codebase anchors — UI to remove / retain
- `taskflow/src/routes/dashboard/index.tsx` — Dashboard root; the 3-card grid (lines 107–130), the retained hero `<section>` (lines 74–101), and the `SmokeTestChart` mount (lines 103–105) to remove
- `taskflow/src/routes/dashboard/SmokeTestChart.tsx` — Phase 81 throwaway scaffold to DELETE (D-01)
- `taskflow/src/routes/dashboard/DashboardSprintCard.tsx` — source of days-remaining (`getDaysRemaining` / `activeSprint.endDate`), %-progress (done/total SP, div-by-zero guard), and the `!subtask` SP-sum filter to reuse (D-04, D-09)
- `taskflow/src/routes/dashboard/DashboardInProgressCard.tsx` — assignee `displayName` match pattern for "personal" filtering (D-05); shares the sprint-board cache key
- `taskflow/src/routes/dashboard/DashboardReleaseCard.tsx` — next-release countdown logic (fix-versions `['jira-fix-versions',activeJiraProject]` cache) to retain (D-01)

### Codebase anchors — assets to reuse
- `taskflow/src/components/chart-wrapper.tsx` (`@/components/chart-wrapper`) + `taskflow/src/components/ui/chart.tsx` — `ChartWrapper` + shadcn chart primitive for the donut (D-07)
- `taskflow/src/components/ui/{skeleton,error-state,empty-state}.tsx` — per-section states (D-11)
- `taskflow/src/components/ui/progress.tsx` — %-progress bar (D-09)
- `taskflow/src/lib/assignee-filter.ts` — assignee predicate helpers, if cleaner than inline displayName compare (D-05)
- `taskflow/src/index.css` — `--chart-1..5` OKLCH tokens + `--color-chart-*` aliases (both themes) for status colors (D-07)
- `taskflow/src/services/jira.ts` — `fetchSprintIssues`, `fetchActiveSprint`, `fetchFixVersions` (warm-cache sources)
- `taskflow/src/stores/auth.store.ts` — `jiraUserDisplayName` for current-user matching (D-05)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ChartWrapper` (`@/components/chart-wrapper`) + shadcn `chart.tsx`: the donut renders inside `ChartWrapper` with `isLoading`/`error`/`isEmpty` props and explicit height — zero per-chart state boilerplate (Phase 81 D-05).
- `DashboardSprintCard` logic: days-remaining, %-progress, and `!subtask` SP filtering already exist — lift, don't reinvent (D-04, D-09).
- `DashboardInProgressCard`: proven `assignee.displayName === jiraUserDisplayName` personal-filter pattern (D-05).
- `DashboardReleaseCard`: fix-versions countdown to retain (D-01).
- Shared `Skeleton`/`ErrorState`/`EmptyState` + `Progress` primitives (D-09, D-11).
- `--chart-1..5` / `--color-chart-*` CSS tokens — no theme code to write (D-07).

### Established Patterns
- Warm-cache reuse: dashboard widgets read the shared `['jira-issues','sprint-board',activeJiraProject,storyPointsFieldKey]` key via `useQuery` (`staleTime` set), never re-fetching — the project's standard against the fetch-once page-cap pitfall and redundant fetching ([[project_fetch_once_pagecap_pitfall]], [[project_enrichment_invalidation_noop]]).
- Recharts: `responsive` prop + explicit-height div + `'use no memo'` in `ChartWrapper` (Phase 81) — keeps React Compiler + WebKit happy (relates to [[project_virtualized_table_zero_width_col]] 0-size class).
- Per-section independent degradation (DASH-07), first applied in Phase 82 D-11.

### Integration Points
- `src/routes/dashboard/index.tsx` rewritten: hero retained, 3-card grid + SmokeTestChart removed, new stat-tiles row + sprint-health section + retained release countdown added.
- Delete `src/routes/dashboard/SmokeTestChart.tsx`.
- New stat-tile / sprint-health components likely under `src/routes/dashboard/`.

</code_context>

<specifics>
## Specific Ideas

- Criterion 2's subtask-exclusion SP unit test (parent 5 + 2×2 subtasks ⇒ 5) is the single most test-worthy piece — write it explicitly. Both the "SP Done" tile and the donut's points-weighting depend on this exclusion.
- Criterion 3 is a hard "zero new API calls" bar — the trickiest part is sprint days-remaining, whose `endDate` came from a separate `fetchActiveSprint` query in the old card (see D-10). Planner must verify that source is warm or relocate days-remaining to the sprint-board payload.
- Status colors MUST be semantic CSS-var aliases, not hardcoded hex (criterion 3) — use `var(--chart-N)` / `--color-chart-*`.

</specifics>

<deferred>
## Deferred Ideas

- **Stat-tile drill-down** — considered and dropped this phase (D-06). To enable later: add an Overdue filter bucket + an incoming filter param (nav-state or `?filter=`) to the Phase 82 My Tasks page, then make tiles link. Easy follow-up if desired.
- **Per-status donut granularity** (one segment per workflow status rather than per statusCategory) — not chosen (D-07); statusCategory's 3 buckets map cleanly to the 3 chart tokens. Revisit only if 3 buckets prove too coarse.
- **MRs-awaiting-review tile and hours-logged tile** — DASH-04/DASH-06, **Phase 84**, not this phase.

None other — discussion stayed within phase scope.

</deferred>

---

*Phase: 83-dashboard-stat-tiles-and-sprint-health-chart*
*Context gathered: 2026-06-15*
