---
phase: 85
slug: sprint-insights-conditional-probe-gated
type: outline
created: 2026-06-15
plan_count: 4
waves: 2
---

# Phase 85 — Plan Outline

> Sprint Insights (Conditional — Probe-Gated). Both probes PASSED 2026-06-15 — both charts BUILD.
> Velocity (INSIGHT-01) and burndown (INSIGHT-02) share Wave 1 foundations but stay on independent
> UI paths so they degrade independently (criteria 3/4/5, D-09/D-10).

## Plan Breakdown

| Plan ID | Objective | Wave | Depends On | Requirements |
|---------|-----------|------|------------|--------------|
| 85-01 | **Foundation: pure functions + mandated unit tests (Wave 0 / VALIDATION map).** Add `computePersonalVelocitySeries` and `parseBurndownChanges` to `dashboardMetrics.ts` (with the D-03 "final-assigned scope" inline comment and V5 defensive parsing — `?? 0`, `Math.max(0, …)`); extract/reuse `formatHoursMinutes`. Add all 7 mandated Vitest unit tests to `dashboardMetrics.test.ts` (tail-first ordering, `!subtask` SP sum, personal displayName filter, `<3`-qualifying guard, committed-vs-completed, `parseBurndownChanges` ascending+clamp, burndown hours-suffix formatter). Must land before any UI consumes these functions. | 1 | — | INSIGHT-01, INSIGHT-02 |
| 85-02 | **Data layer: `services/jira.ts` barrel functions.** Add `fetchClosedSprints` (paginate via `startAt`, slice the tail — most-recent N, NEVER first page per Probe A landmine; mandated ordering comment) and `fetchSprintIssuesBySprintId` (SP fields sourced via `discoverCustomFields`/passed `spKey`, never hardcode `customfield_10106`). Set up the dedicated `p-limit(3)` for velocity fan-out (NOT global `getJiraLimit()`). Burndown access via `greenhopperFetch` with `apiPath=''` full rapid-charts path override (D-08). Bearer PAT + `apiFetch('jira',…)` semantics (Phase 71 D-04). | 1 | — | INSIGHT-01, INSIGHT-02 |
| 85-03 | **Velocity chart UI (INSIGHT-01).** Create `VelocityChart.tsx` via `ChartWrapper` + `ChartContainer`: `useQuery` (closedSprints, `staleTime: Infinity`) + `useQueries` fan-out under `p-limit(3)` (per-sprint `staleTime: Infinity`), token in `queryFn` closure only (T-84-02). Grouped `BarChart` committed (`--chart-1` 40% opacity) vs completed (`--chart-2`). `<3 qualifying sprints` → custom `EmptyState` as children with `isEmpty={false}` (D-06, NOT generic isEmpty). `'use no memo'`, `responsive` prop, explicit-height div, `isAnimationActive={false}`, `role="region"`, D-10 probe-outcome comment, runtime error/omission via `ChartWrapper`. | 2 | 85-01, 85-02 | INSIGHT-01 |
| 85-04 | **Burndown chart UI (INSIGHT-02) + Dashboard wiring.** Create `BurndownChart.tsx` via `ChartWrapper`: `useQuery` burndown (standard `staleTime: 30_000`, NOT Infinity — D-09; independent mid-session degradation), `AreaChart` remaining (`--chart-3`) + dashed ideal guideline (`--muted-foreground`), hours Y-axis (`tickFormatter` `${v}h`), `formatHoursMinutes` tooltip — hours NOT story points (Probe C). D-10 probe comment. Then wire `index.tsx`: append both sections at the bottom in `grid-cols-1 lg:grid-cols-2 gap-4` row (after Activity & Releases); resolve `boardId` (reuse `useBoardId`, never hardcode 6708) + `activeSprintId` and pass as props (D-16 props-only). | 2 | 85-01, 85-02 | INSIGHT-02 |

## Wave Structure

| Wave | Plans | Files (disjoint within wave) |
|------|-------|------------------------------|
| 1 | 85-01, 85-02 | 01: `dashboardMetrics.ts`, `dashboardMetrics.test.ts` · 02: `services/jira.ts` (no overlap → parallel) |
| 2 | 85-03, 85-04 | 03: `VelocityChart.tsx` · 04: `BurndownChart.tsx`, `index.tsx` (no overlap → parallel) |

## Coverage Audit

- **GOAL** (ROADMAP §85 — probe-gated build + clean omission): probes already documented in CONTEXT `<probe_results>` (criterion 1 SATISFIED); build paths covered by 85-03/04; runtime graceful omission covered by D-10 paths in 85-03 (velocity error/omit) and 85-04 (burndown independent degradation). ✅
- **REQ** INSIGHT-01 → 85-01, 85-02, 85-03 · INSIGHT-02 → 85-01, 85-02, 85-04. Every requirement ID covered. ✅
- **RESEARCH** (5 patterns + Validation Architecture + Security Domain): tail paginator + p-limit(3) → 85-02; velocity/burndown pure fns + V5 defensive parsing → 85-01; greenhopper path override → 85-02/85-04; chart render → 85-03/04; all 7 mandated tests → 85-01. ✅
- **CONTEXT** D-01..D-11: D-01/D-03/D-04 → 85-01 · D-02/D-05/D-08 → 85-02 · D-05(query)/D-06/D-11 → 85-03 · D-07/D-08/D-09/D-11 → 85-04 · D-10 → 85-03 + 85-04. All locked decisions covered; no deferred ideas planned. ✅

No unplanned items. No phase split needed (all within context budget; each plan ≤3 tasks).
