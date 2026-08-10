# Phase 85: Sprint Insights (Conditional — Probe-Gated) - Context

**Gathered:** 2026-06-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Add **two new probe-gated Dashboard sections**, each built only because its live Jira DC probe passed (run 2026-06-15 — results below):

1. **Personal velocity chart (INSIGHT-01)** — committed vs completed story points across the last N **closed** sprints (personal, displayName-scoped). Data via new `fetchClosedSprints` + `fetchSprintIssuesBySprintId` barrel functions, `staleTime: Infinity`, `p-limit(3)` fan-out. Hidden with an explanatory message if fewer than 3 qualifying closed sprints exist.
2. **Sprint burndown chart (INSIGHT-02)** — current active-sprint burndown from the GreenHopper `scopechangeburndownchart` endpoint. **Time-estimate-based (hours remaining)** on this DC instance — not story points (see Probe C).

Both sections degrade independently (own loading/error state) and never block or delay other Dashboard sections. WHAT this phase delivers is locked by ROADMAP §Phase 85's 5 success criteria and requirements INSIGHT-01, INSIGHT-02. This discussion captured the probe outcomes + the HOW decisions left open. No new capabilities — new ideas go to other phases.

</domain>

<probe_results>
## Live DC Probe Results — run 2026-06-15 (criterion 1)

**Instance:** `https://jira.corp.sk`, project `PROJ`, board discovery → **boardId/rapidViewId = 6708** ("Copy of PROJ Scrum Board"; the board the app's existing `fetchActiveSprint` resolves to via `/board?projectKeyOrId` → `values[0]`). A second board (163 "PROJ Scrum Board") exists — **planner must use the SAME board the app already resolves, never hardcode 6708.** Active sprint at probe time = `19562`.

Probe harness preserved at `.planning/phases/85-sprint-insights-conditional-probe-gated/probe.sh` (read-only, self-discovering; re-runnable).

### Probe A — closed-sprint REST endpoint (INSIGHT-01a) → **PASS**
`GET /rest/agile/1.0/board/6708/sprint?state=closed&maxResults=5` returned **5 closed sprints, all with `startDate`/`endDate`/`completeDate`**.
⚠ **LANDMINE (ordering):** the endpoint returns closed sprints **ascending (oldest first)** — the 5 returned were 2019 sprints (ids 44, 102, 106, 107, 227) while the active sprint is 19562 (current). A "last N closed sprints" trend MUST fetch the **most-recent** closed sprints (paginate to the tail via `startAt`, or fetch the full closed list and slice the last N) — **never the first page**.

### Probe B — SP field populated on closed-sprint issues (INSIGHT-01b) → **PASS**
`storyPointsFieldKey = customfield_10106` (discovered, not hardcoded). `GET /rest/agile/1.0/sprint/227/issue?fields=customfield_10106,status,assignee` returned 60 issues; SP present on a subset (3/10 sampled — many `null`). Assignee present as displayName (`"MRKVA Jozef CORP (ext.) [X]"`), confirming personal scoping is viable.
⚠ **LANDMINE (sparse SP):** SP is sparsely populated on older sprints. After personal filtering, a user may have <3 closed sprints with any SP — the "hide with explanatory message if <3" guard (criterion 2) is the real safety net here. Sums simply take whatever SP exists (`null` → 0/excluded).

### Probe C — GreenHopper burndown (INSIGHT-02) → **PASS**
`GET /rest/greenhopper/1.0/rapid/charts/scopechangeburndownchart?rapidViewId=6708&sprintId=19562` returned the full shape: keys `["activatedTime","changes","endTime","issueToParentKeys","issueToSummary","now","openCloseChanges","startTime","statisticField","workRateData"]`, `.changes` with **496 timeline entries**.
⚠ **KEY FINDING (unit):** `statisticField = timeestimate` ("Remaining Time Estimate", renderer `duration`). This DC's burndown is **TIME-based (hours remaining), not story points.** The chart renders a time-remaining burndown — honest to the data; INSIGHT-02 does not mandate points.

### Cost approval (criterion 1c) → **APPROVED**
User is the product owner. Velocity backfill = N≤6 closed-sprint issue fetches under `p-limit(3)` ≈ 2 request waves. Negligible cost; approved.

**Both charts BUILD. Neither is omitted.** (Criteria 3 / 5 omission paths are still implemented as graceful runtime degradation in case the endpoints become unavailable mid-session.)

</probe_results>

<decisions>
## Implementation Decisions

### Velocity Chart — Data Definition (INSIGHT-01)
- **D-01:** **Personal scope.** Filter closed-sprint issues to the current user via assignee `displayName` === `jiraUserDisplayName` (the locked Phase 83 D-05 / `DashboardInProgressCard` pattern). Reuse `lib/assignee-filter.ts` if a cleaner predicate exists; do NOT introduce accountId plumbing.
- **D-02:** **N = last 6 closed sprints** (most-recent), minimum 3 required. Per Probe A's ordering landmine, fetch the most-recent closed sprints (tail of the ascending list), not the first page.
- **D-03:** **"Committed" = sum of SP of ALL issues assigned to me in the closed sprint (final state); "completed" = sum of SP of my DONE issues** (`statusCategory.key === 'done'`). Both derived from the single prescribed agile `/sprint/{id}/issue` endpoint — **no third probe / no GreenHopper sprintreport** (that endpoint is team-level, not per-assignee, so it can't serve a *personal* committed-vs-completed split).
  - ⚠ **Mandated code comment:** "committed" here = my *final-assigned* sprint scope, NOT start-of-sprint commitment — mid-sprint scope additions and assignee changes are not captured. Acceptable approximation for a personal trend; document this inline so it isn't mistaken for true Jira sprint-commitment.
- **D-04:** **SP sums exclude subtasks** (reuse the established `!i.fields.issuetype.subtask` filter), consistent with Phase 83 D-04. `null` SP counts as 0 / excluded from sums.
- **D-05:** **Fetch + cache:** new `fetchClosedSprints` + `fetchSprintIssuesBySprintId` in the `services/jira.ts` barrel; per-sprint issue fetches fan out under a **dedicated `p-limit(3)`** cap (criterion 1c — a tighter cap than the global `p-limit(6)` in `lib/concurrency.ts`, scoped to this backfill). Query uses **`staleTime: Infinity`** — closed-sprint data never changes (criterion 2).
- **D-06:** **<3 qualifying closed sprints → hide the chart with an explanatory inline message** (criterion 2), NOT an error state. "Qualifying" = closed sprints where the personal SP sum is derivable.

### Burndown Chart — Data Definition (INSIGHT-02)
- **D-07:** **Active sprint only.** Render the GreenHopper `scopechangeburndownchart` series **as-is** for the app's current active sprint, using the **same resolved `boardId` as `rapidViewId`** the app already uses (not hardcoded). Source the `.changes` timeline + `.workRateData` guideline; unit = **time remaining (hours)** per Probe C's `statisticField: timeestimate`.
- **D-08:** **Reuse the existing GreenHopper client pattern** — calls go through `apiFetch('jira', ...)` with `Bearer` PAT (per Phase 71 D-04; same host/PAT/401 semantics). NOTE: rapid-charts live at `/rest/greenhopper/1.0/rapid/charts/...`, **not** the `GREENHOPPER_API_PATH` (`/xboard`) base — pass the full rapid-charts path explicitly.
- **D-09:** **Mid-session unavailability degrades independently** (criterion 4) — if the endpoint fails on a later poll, the burndown section shows its own error/empty state without affecting other sections. The chart is **not** `staleTime: Infinity` (active sprint burndown changes during the sprint) — standard staleTime + own loading/error.

### Graceful Omission (criteria 3 & 5)
- **D-10:** Although both probes passed, implement the omission paths as **runtime graceful degradation**: if a velocity/burndown query errors or returns unusable data at runtime, the section is cleanly omitted (velocity) or shows its own empty/error state (burndown) — never blanks the Dashboard. A code comment in each section documents the 2026-06-15 probe outcome (criterion 3).

### Charting Stack (locked by Phase 81 — do not re-litigate)
- **D-11:** Recharts v3 via `ChartWrapper` + shadcn `chart` primitive; `responsive` prop (never `ResponsiveContainer`); explicit-height outer div (WebKit 0×0 guard); `isAnimationActive={false}`; **`var(--chart-N)` CSS-var colors** (no hardcoded hex); per-section `Skeleton`/`ErrorState`/`EmptyState` via `ChartWrapper`.

### Claude's Discretion (user delegated chart form + layout)
- **Velocity chart type** — default: per-sprint **overlaid/grouped bars** (committed as faint full-height bar, completed as filled foreground), X = sprint name, Y = SP. A dual-line or bar+trendline variant is acceptable if it reads better.
- **Burndown chart type** — default: a **line/area** of remaining-time-vs-guideline derived from `.changes` + `.workRateData`, X = sprint timeline, Y = hours remaining.
- **Dashboard placement** — both sections appended at the **bottom** of the Dashboard (below Phase 84's Activity & Releases), consistent with the additive section pattern; pairing the two insight charts on wide screens is fine. Independent degradation (DASH-07 lineage) preserved.
- **The "<3 sprints" message wording** (D-06) and exact component decomposition (`VelocityChart`, `BurndownChart` vs inline) — reuse/adapt over net-new where sensible.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap (the acceptance bar)
- `.planning/REQUIREMENTS.md` — INSIGHT-01, INSIGHT-02 (lines 47–48), §"Sprint Insights (Conditional — probe-gated)".
- `.planning/ROADMAP.md` §Phase 85 (lines 488–512) — goal + 5 success criteria. Criterion 1 = documented probe results (SATISFIED — see `<probe_results>` above); criterion 2 = velocity via `fetchClosedSprints` + `fetchSprintIssuesBySprintId`, `staleTime: Infinity`, ≥3 sprints, independent section; criterion 3 = clean omission + code comment on velocity failure; criterion 4 = burndown for active sprint, independent mid-session degradation; criterion 5 = clean omission + documented decision on burndown failure.

### This phase's probe artifact
- `.planning/phases/85-sprint-insights-conditional-probe-gated/probe.sh` — the read-only, self-discovering probe harness (re-runnable). Probe outcomes are recorded in `<probe_results>` above.

### Charting stack (locked by Phase 81 — do not re-litigate)
- `.planning/phases/81-charting-foundation/81-CONTEXT.md` — D-01..D-08: Recharts v3 + shadcn `chart` primitive, `responsive` prop, explicit-height div, `isAnimationActive={false}`, `var(--chart-N)`, `ChartWrapper` status-prop API.
- `.planning/research/STACK.md` / `.planning/research/PITFALLS.md` §1–3 — charting versions + 0×0 collapse / React Compiler / theme-token pitfalls.

### Prior phase patterns (locked — do not re-litigate)
- `.planning/phases/83-dashboard-stat-tiles-and-sprint-health-chart/83-CONTEXT.md` — D-04 (`!subtask` SP-sum filter + unit test), D-05 (assignee `displayName` personal-filter pattern), D-11 (per-section independent degradation).
- `.planning/phases/84-dashboard-trend-chart-mr-review-queue-and-activity-strip/84-CONTEXT.md` — additive-section + independent-degradation pattern these two charts extend; `ChartWrapper`-based BarChart precedent.

### Codebase anchors — Jira service (extend the barrel)
- `taskflow/src/services/jira.ts` — barrel; `fetchActiveSprint` (lines ~1329–1375; board discovery via `/board?projectKeyOrId` → `values[0].id`, the **same** boardId velocity+burndown must reuse), `discoverCustomFields` (line 1502; `customfield_10106` SP key). Add `fetchClosedSprints` + `fetchSprintIssuesBySprintId` here.
- `taskflow/src/services/jira/sprints.ts` — existing sprint endpoints (`state=active`, `state=active,future`); the closed-sprint fetch mirrors these but must paginate to the **most-recent** closed sprints (Probe A ordering landmine).
- `taskflow/src/services/jira/greenhopper/client.ts` — `greenhopperFetch` (Bearer PAT, `apiFetch('jira',...)`, Phase 71 D-04). NOTE: it defaults to the `/xboard` base path; the burndown endpoint is `/rest/greenhopper/1.0/rapid/charts/scopechangeburndownchart` — pass the full rapid-charts path (override `apiPath` or build the URL directly).
- `taskflow/src/lib/concurrency.ts` — global `p-limit(6)` `getJiraLimit()`; the velocity backfill uses its own dedicated `p-limit(3)` (criterion 1c), not the global instance.

### Codebase anchors — Dashboard + assets to reuse
- `taskflow/src/routes/dashboard/index.tsx` — Dashboard root; the two new sections append at the bottom (after Phase 84's Activity & Releases).
- `taskflow/src/components/chart-wrapper.tsx` + `taskflow/src/components/ui/chart.tsx` — `ChartWrapper` (isLoading/error/isEmpty + explicit height) for both charts (D-11).
- `taskflow/src/routes/dashboard/DashboardInProgressCard.tsx` / `DashboardSprintCard.tsx` — `assignee.displayName === jiraUserDisplayName` personal filter (D-01) and `!subtask` SP-sum filter (D-04) to lift.
- `taskflow/src/lib/assignee-filter.ts` — assignee predicate helpers (D-01).
- `taskflow/src/stores/auth.store.ts` — `jiraUserDisplayName` (personal matching).
- `taskflow/src/index.css` — `--chart-1..5` OKLCH tokens + `--color-chart-*` aliases (both themes) for bar/line colors (D-11).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ChartWrapper` + shadcn `chart.tsx`: both charts render inside `ChartWrapper` with built-in loading/error/empty + explicit height — no per-chart state boilerplate (Phase 81).
- `fetchActiveSprint` (jira.ts): the board-discovery + active-sprint resolution to reuse for both the velocity board id and the burndown `rapidViewId`/active sprint — don't re-implement board discovery.
- `greenhopperFetch`: Bearer-PAT GreenHopper client for the burndown call (override base path to `/rest/greenhopper/1.0/rapid/charts`).
- `discoverCustomFields`: yields `storyPointsFieldKey` (`customfield_10106` on this DC) — never hardcode the SP key.
- `assignee.displayName` personal filter (DashboardInProgressCard) + `!subtask` SP filter (DashboardSprintCard) — lift for the personal velocity sums.
- `--chart-N` CSS tokens — no theme code to write.

### Established Patterns
- Warm-cache reuse via shared TanStack Query keys; closed-sprint data is the strongest case for `staleTime: Infinity` (it never changes) — D-05.
- `p-limit` concurrency capping for Jira fan-out ([[project_fetch_once_pagecap_pitfall]] is the *opposite* failure — here we deliberately fetch per-sprint, capped at 3, not one capped page).
- Per-section independent degradation (DASH-07), applied since Phase 82 D-11.
- Recharts `responsive` prop + explicit-height div + `'use no memo'` in `ChartWrapper` (Phase 81; relates to [[project_virtualized_table_zero_width_col]]).

### Integration Points
- `src/routes/dashboard/index.tsx` gains two bottom sections (likely new `VelocityChart` + `BurndownChart` components under `src/routes/dashboard/`).
- New `fetchClosedSprints` + `fetchSprintIssuesBySprintId` in the `services/jira.ts` barrel; new dedicated `p-limit(3)` for the velocity backfill.
- New GreenHopper rapid-charts call (burndown) reusing `greenhopperFetch` semantics with the rapid-charts base path.

</code_context>

<specifics>
## Specific Ideas

- **Probe A ordering is the #1 implementation trap** — `state=closed` is ascending; a "last 6 closed sprints" fetch that reads the first page silently charts 2019 data. Write a test that asserts the most-recent (not earliest) closed sprints are selected.
- **The "committed = final-assigned scope" approximation MUST carry an inline code comment** (D-03) so it's never mistaken for true Jira sprint commitment.
- **Burndown unit is hours, not points, on this DC** (Probe C `statisticField: timeestimate`) — label the axis accordingly; don't assume story points.
- SP key is **`customfield_10106`** on this instance — but always source it from `discoverCustomFields`, never hardcode.
- Both sections must survive a mid-session endpoint failure without blanking the Dashboard (criteria 3/4/5).

</specifics>

<deferred>
## Deferred Ideas

- **True team velocity via GreenHopper `sprintreport`** (committed/completed at sprint level with initial-estimate sums) — considered and not used because INSIGHT-01 is *personal* and sprintreport is team-level/non-per-assignee (D-03). A future "team velocity" insight could use it.
- **Points-based burndown** — this DC's `scopechangeburndownchart` tracks time (hours); a story-points burndown would need a different board config or a client-side recompute. Revisit only if a points burndown is specifically wanted (its own phase).
- **Configurable N** for the velocity window (currently fixed at 6, D-02) — lift to a setting later if desired.
- **Backfilling SP on legacy sprints** — out of scope; the <3-sprints guard handles sparse historical data.

None other — discussion stayed within phase scope.

</deferred>

---

*Phase: 85-sprint-insights-conditional-probe-gated*
*Context gathered: 2026-06-15*
