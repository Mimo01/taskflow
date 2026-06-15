---
phase: 85-sprint-insights-conditional-probe-gated
plan: "01"
subsystem: dashboard-metrics
tags: [velocity, burndown, pure-functions, unit-tests, formatter-extraction]
dependency_graph:
  requires: []
  provides:
    - computePersonalVelocitySeries (dashboardMetrics.ts)
    - parseBurndownChanges (dashboardMetrics.ts)
    - formatHoursMinutes (dashboardMetrics.ts — extracted from WeeklyTrendChart)
    - VelocityPoint interface
    - BurndownPoint interface
  affects:
    - taskflow/src/routes/dashboard/WeeklyTrendChart.tsx (imports formatHoursMinutes, no local copy)
tech_stack:
  added: []
  patterns:
    - TDD pure-function extension of dashboardMetrics.ts
    - Defensive V5 input validation (changes ?? {}, ?? 0, Math.max(0,…))
    - Formatter extraction to single source of truth
key_files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/dashboardMetrics.ts
    - taskflow/src/routes/dashboard/dashboardMetrics.test.ts
    - taskflow/src/routes/dashboard/WeeklyTrendChart.tsx
decisions:
  - "D-03 approximation comment placed verbatim above committed reduce (mandatory inline comment)"
  - "formatHoursMinutes extracted to dashboardMetrics.ts as single source of truth for Phase 85 burndown hours axis/tooltip (Probe C: timeestimate unit)"
  - "parseBurndownChanges seeds anchor at {t:startTime, remaining:0} before any changes (ascending series guarantee)"
  - "node_modules symlink created in worktree taskflow/ to resolve vitest — worktree shares main repo packages"
metrics:
  duration: "~25 minutes"
  completed: "2026-06-15"
  tasks_completed: 3
  files_modified: 3
---

# Phase 85 Plan 01: Pure Derivation Functions + 7 Mandated Tests Summary

Pure-function foundation for Phase 85 Sprint Insights: `computePersonalVelocitySeries` (INSIGHT-01), `parseBurndownChanges` (INSIGHT-02), extracted `formatHoursMinutes` (single source of truth for burndown hours axis/tooltip), and all 7 mandated Vitest unit tests green.

## What Was Built

### `dashboardMetrics.ts` extensions

**`formatHoursMinutes(hours: number): string`** — Extracted verbatim from `WeeklyTrendChart.tsx` and re-exported as the canonical Phase 85 hours formatter. JSDoc notes it is the single source of truth for the burndown hours axis/tooltip (never SP). WeeklyTrendChart now imports it rather than maintaining a local copy.

**`interface VelocityPoint`** — `{ sprintName, committed, completed }` shape consumed by 85-03 VelocityChart.

**`computePersonalVelocitySeries(sprints, issuesBySprint, displayName, spKey)`** — Maps sprint list to VelocityPoint array. Implements:
- Personal filter via `assignee?.displayName === displayName` (D-01)
- Subtask exclusion via `!issuetype.subtask` (D-04)
- `committed` = sum of all my non-subtask SP (D-03); `?? 0` null-SP guard (T-85-02)
- `completed` = sum of my DONE non-subtask SP (`statusCategory.key === 'done'`)
- D-03 mandatory inline comment placed verbatim above the committed reduce
- Does NOT slice/reorder sprints — tail selection is the 85-02 fetcher's job (Probe A landmine)

**`interface BurndownPoint`** — `{ t: number; remaining: number }` where `t` is epoch ms and `remaining` is seconds (inline unit comment for 85-04 tooltip `/3600` conversion).

**`parseBurndownChanges(changes, startTime)`** — V5-defensive burndown parser implementing T-85-01:
- `const safe = changes ?? {}` guards null/undefined input
- `Object.keys(safe).map(Number).sort((a,b)=>a-b)` numeric ascending sort (string sort misorders epochs)
- Seeds `[{ t: startTime, remaining: 0 }]` as sprint-start anchor
- `?? 0` on `newValue`/`oldValue` guards malformed numeric fields (A2 assumption defensive)
- `Math.max(0, running)` clamp guards negative remaining (Tampering mitigation T-85-01)
- Entries without `statC` are skipped without throwing

### `dashboardMetrics.test.ts` — 7 mandated tests added

All 7 VALIDATION `-t` filter strings pass. 40 total tests (33 pre-existing + 7 new), all green.

| Filter | Describe | Test |
|--------|----------|------|
| `tail` | computePersonalVelocitySeries | Selects last N sprints from ascending list (Probe A guard) |
| `subtask exclusion` | computePersonalVelocitySeries | parent(5)+2 subtasks(2ea)=5, not 9 |
| `personal velocity` | computePersonalVelocitySeries | Alice(8)+Bob(10) → committed=8 (Bob excluded) |
| `qualifying sprints` | computePersonalVelocitySeries | sprint with 0 committed+completed is not qualifying (D-06) |
| `committed vs completed` | computePersonalVelocitySeries | done(3)+indeterminate(5) → committed=8, completed=3 |
| `parseBurndownChanges` | parseBurndownChanges | ascending-time anchor + null-input no-throw (V5) |
| `burndown hours` | formatHoursMinutes | h/m suffix, never SP (Probe C: timeestimate unit) |

### `WeeklyTrendChart.tsx`

Updated `import` to add `formatHoursMinutes` from `./dashboardMetrics`; removed the local `function formatHoursMinutes` definition. Two call sites unchanged.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Operational Notes

**node_modules symlink created** — The worktree's `taskflow/` directory has no `node_modules` (packages live in the main repo's `taskflow/node_modules`). Created a symlink `/worktrees/agent-a3ce84d79e7c6c39c/taskflow/node_modules → /taskflow/node_modules` to allow `vitest` to resolve from within the worktree. This is a worktree-execution infrastructure detail, not a deviation from the plan.

## Success Criteria Verification

- [x] `computePersonalVelocitySeries` exported from `dashboardMetrics.ts` with documented signature
- [x] `parseBurndownChanges` exported with V5 defensive parsing (`changes ?? {}`, `?? 0`, `Math.max(0,…)`)
- [x] D-03 mandatory inline comment present verbatim above committed reduce
- [x] `formatHoursMinutes` exported from `dashboardMetrics.ts`; `WeeklyTrendChart.tsx` imports it (no local copy)
- [x] All 7 VALIDATION `-t` filters select a passing test
- [x] Full dashboardMetrics suite green (40/40)
- [x] No UI or barrel fetcher added — pure-logic + test foundation for 85-02/03/04

## Self-Check: PASSED

Files created/modified:
- FOUND: taskflow/src/routes/dashboard/dashboardMetrics.ts
- FOUND: taskflow/src/routes/dashboard/dashboardMetrics.test.ts
- FOUND: taskflow/src/routes/dashboard/WeeklyTrendChart.tsx

Commits:
- FOUND: 506c0d07
