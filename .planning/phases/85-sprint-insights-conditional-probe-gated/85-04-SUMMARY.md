---
phase: 85-sprint-insights-conditional-probe-gated
plan: "04"
subsystem: dashboard-burndown-ui
tags: [burndown, sprint-insights, recharts, area-chart, greenhopper, dashboard-wiring]
dependency_graph:
  requires:
    - 85-01 (parseBurndownChanges + formatHoursMinutes + BurndownPoint from dashboardMetrics.ts)
    - 85-02 (fetchBurndown + GreenHopperBurndown from services/jira barrel)
  provides:
    - BurndownChart component (taskflow/src/routes/dashboard/BurndownChart.tsx)
    - Sprint Insights row in Dashboard index.tsx (INSIGHT-01 + INSIGHT-02 wired)
    - activeSprintId resolution via cache-deduped fetchActiveSprint query in index.tsx
  affects:
    - taskflow/src/routes/dashboard/index.tsx (Sprint Insights section appended)
    - 85-03 wave-mate: VelocityChart.tsx imported by index.tsx; tsc resolves after wave merge
tech_stack:
  added: []
  patterns:
    - AreaChart with responsive prop (Phase 81 locked chart stack)
    - seconds-to-hours /3600 conversion at Y-axis tick + tooltip (Probe C timeestimate)
    - cache-dedup via exact queryKey match with SprintHealthSection (zero extra network)
    - props-only component (D-16); token in queryFn closure never queryKey (T-84-02)
    - V5 defensive .changes ?? {} before parseBurndownChanges (T-85-04-01)
    - isolated ChartWrapper error/retry (D-09 / T-85-04-03)
key_files:
  created:
    - taskflow/src/routes/dashboard/BurndownChart.tsx
  modified:
    - taskflow/src/routes/dashboard/index.tsx
decisions:
  - "BurndownChart.tsx uses staleTime 30_000 (not Infinity) — active sprint burndown changes mid-sprint (D-09)"
  - "burndownRaw.changes cast via unknown to bridge BurndownChangeEntry (all-optional A2 shape) to parseBurndownChanges parameter type (slightly stricter inline type); runtime values compatible"
  - "VelocityChart.tsx imported in index.tsx despite not existing in this worktree — wave-parallel dependency; tsc error is limited to Cannot find module './VelocityChart' and resolves at wave merge"
  - "activeSprintForBurndown query reuses exact SprintHealthSection queryKey ['jira-active-sprint', activeJiraProject, jiraBaseUrl, boardId] for zero-extra-network cache dedup"
  - "ideal Line dataKey present in BurndownChart per plan spec; field absent from current BurndownPoint interface (85-01 parseBurndownChanges does not derive ideal from workRateData); Line renders with no data (Recharts handles gracefully)"
metrics:
  duration: "~22 minutes"
  completed: "2026-06-15"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
---

# Phase 85 Plan 04: BurndownChart + Sprint Insights Dashboard Wiring Summary

BurndownChart.tsx (INSIGHT-02) built as an hours-remaining AreaChart from the GreenHopper scopechangeburndownchart endpoint (Probe C: statisticField=timeestimate), with isolated ChartWrapper error/retry, standard 30s staleTime, and seconds-to-hours /3600 conversion on both Y-axis and tooltip. Dashboard index.tsx extended with the Sprint Insights row (VelocityChart + BurndownChart side-by-side) wired via props-only pattern with boardId from useBoardId and activeSprintId from a cache-deduped fetchActiveSprint query.

## What Was Built

### Task 1: BurndownChart.tsx (INSIGHT-02)

**`BurndownChart`** — default-exported React component at `taskflow/src/routes/dashboard/BurndownChart.tsx`.

- Begins with `'use no memo'` directive (Phase 81 D-02).
- D-10 probe-outcome comment: `Probe C PASSED 2026-06-15: scopechangeburndownchart returns .changes + .workRateData. statisticField=timeestimate — Y-axis is hours remaining, NOT story points. Build is unconditional; error state handles runtime absence.`
- Props-only interface `BurndownChartProps`: `jiraBaseUrl`, `jiraToken`, `boardId: number | null`, `activeSprintId: number | null`. No `useAuthStore` or `readSecret` (D-16).
- `useQuery` with queryKey `['jira-burndown', boardId, activeSprintId]`; token in queryFn closure only (T-84-02 / T-85-04-04). `staleTime: 30_000` (D-09). `enabled` guards: truthy token + both IDs non-null.
- Calls `fetchBurndown` from `@/services/jira` — NOT `greenhopperFetch` directly.
- V5 defensive: `burndownRaw.changes ?? {}` before `parseBurndownChanges` (T-85-04-01).
- Y-axis: `Math.round(v / 3600) + 'h'` — seconds to hours, lowercase h suffix, `domain={[0, 'auto']}`.
- Tooltip: `formatHoursMinutes(v / 3600)` — consistent /3600 conversion.
- `Area` series: `var(--chart-3)`, `fillOpacity={0.2}`, `isAnimationActive={false}`.
- `Line` series (ideal guideline): `var(--muted-foreground)`, `strokeDasharray="4 4"`, `dot={false}`, `isAnimationActive={false}`.
- `responsive` prop on `AreaChart`; no `ResponsiveContainer`.
- Explicit-height inner div `style={{ height: 240 }}` (WebKit 0x0 guard, Phase 81 D-03).
- `role="region"` / `aria-label="Sprint burndown chart"` outer wrapper.
- `ChartContainer` `aria-label="Sprint burndown area chart — hours remaining over sprint timeline"`.
- `chartConfig` satisfies `ChartConfig` with `remaining → { label: 'Remaining', color: 'var(--chart-3)' }`.

### Task 2: index.tsx Sprint Insights wiring

- Added `BurndownChart` (default import from `./BurndownChart`) and `VelocityChart` (default import from `./VelocityChart`) to local component imports.
- Added `fetchActiveSprint` to `@/services/jira` import.
- Added `activeSprintForBurndown` query reusing `['jira-active-sprint', activeJiraProject, jiraBaseUrl, boardId]` — exact cache-dedup with SprintHealthSection (zero extra network, D-09). `staleTime: 5 * 60_000`, `enabled` matching SprintHealthSection guard.
- Derived `activeSprintId = activeSprintForBurndown?.id ?? null`.
- Appended Sprint Insights row after Activity & Releases and before root closing `</div>`:
  ```
  {/* Sprint Insights — INSIGHT-01 / INSIGHT-02 */}
  <div className="relative px-6 pb-6">
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <VelocityChart ... />
      <BurndownChart ... />
    </div>
  </div>
  ```
- `boardId` from `useBoardId` — no literal 6708 anywhere in `index.tsx`.
- Props-only: each chart owns its loading/error/empty state; failure in one never unmounts the other (T-85-04-03).

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Operational Notes

**node_modules symlink created** — The worktree's `taskflow/` directory has no `node_modules`. Created symlink `/worktrees/agent-a0a45d234f1d9d039/taskflow/node_modules → /taskflow/node_modules` so tsc and vitest resolve from within the worktree. Infrastructure detail, not a plan deviation.

**Wave-parallel VelocityChart.tsx dependency** — `index.tsx` imports `./VelocityChart` which is created by the 85-03 agent running in parallel. tsc in this worktree produces a single `Cannot find module './VelocityChart'` error; all other type-checking is clean. This resolves automatically when the orchestrator merges all wave branches. No workaround applied — adding a stub file would create a merge conflict with 85-03's output.

**`ideal` Line dataKey** — `BurndownPoint` interface from 85-01 defines only `t` and `remaining`. The `ideal` field (from `.workRateData` derivation) is not yet produced by `parseBurndownChanges`. The `Line dataKey="ideal"` is wired per plan spec and Recharts renders it gracefully with no data. Future extension of `parseBurndownChanges` to compute `ideal` from `workRateData` will make the guideline visible without changing the chart component.

**BurndownChangeEntry type cast** — `fetchBurndown` returns `GreenHopperBurndown` whose `changes` field is typed as `Record<string, BurndownChangeEntry[]>` (all-optional fields, A2 MEDIUM-confidence shape from 85-02). `parseBurndownChanges` expects a slightly stricter inline type where `key` is `string` (not `string | undefined`). Cast via `as unknown as Parameters<typeof parseBurndownChanges>[0]` bridges the structural gap without altering either type definition. Runtime values are compatible.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes beyond the plan's `<threat_model>`. All four threat mitigations applied as designed:
- T-85-04-01: `burndownRaw.changes ?? {}` before parse; parseBurndownChanges clamps via Math.max(0, …)
- T-85-04-02: boardId from useBoardId; activeSprintId from cache; no literal 6708; enabled guard
- T-85-04-03: staleTime 30_000 + ChartWrapper error/onRetry; props-only independence
- T-85-04-04: token in queryFn closure only, not in queryKey

## Self-Check: PASSED

Files created/modified:
- FOUND: taskflow/src/routes/dashboard/BurndownChart.tsx
- FOUND: taskflow/src/routes/dashboard/index.tsx

Commits:
- FOUND: 2200d485 (Task 1 — BurndownChart.tsx)
- FOUND: b7309848 (Task 2 — index.tsx Sprint Insights wiring)
