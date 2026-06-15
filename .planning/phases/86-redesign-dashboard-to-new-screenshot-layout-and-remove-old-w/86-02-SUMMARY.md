---
phase: 86-redesign-dashboard-to-new-screenshot-layout-and-remove-old-w
plan: "02"
subsystem: dashboard
tags: [recharts, dual-axis, tempo, gitlab, composed-chart, rolling-7, tdd]
dependency_graph:
  requires:
    - 86-01 (Recharts + ChartWrapper foundation — provides ComposedChart, ChartContainer, ChartConfig)
  provides:
    - HoursCommitsChart component (props-only, D-16)
    - buildRolling7Buckets helper (exported, unit-tested)
  affects:
    - dashboard/index.tsx (wired in Plan 03)
tech_stack:
  added: []
  patterns:
    - dual-axis ComposedChart with matching yAxisId on Bar + YAxis (Recharts v3 pitfall mitigated)
    - useQueries × 7 for parallel per-day GitLab commit fetches (same cache key as ActivityStrip)
    - buildRolling7Buckets: rolling-7 window adapts buildWeekBuckets, uses string equality on dateStarted
    - TodayAwareTick: foreignObject pill in SVG X-axis (Assumption A2 — verified Plan 04)
    - 'use no memo' + explicit-height div + isAnimationActive={false} (Phase 81 charting contract)
key_files:
  created:
    - taskflow/src/routes/dashboard/HoursCommitsChart.tsx
    - taskflow/src/routes/dashboard/HoursCommitsChart.test.tsx
  modified: []
decisions:
  - "toISOString used ONLY inside addDays (Date.UTC → UTC read = DST-immune); bucketing uses en-CA string equality"
  - "Token props passed to queryFn closures, never appear in queryKey arrays (T-86-05)"
  - "tempoEnabled=false is the ONLY empty state — all-zero connected week renders flat bars (D-12 Pitfall 6)"
  - "foreignObject for today pill (Assumption A2) — SVG text+rect fallback documented in component comments"
  - "minPointSize={1} on commits Bar to ensure 0-value bars remain visible"
metrics:
  duration: "5m"
  completed: "2026-06-15"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
---

# Phase 86 Plan 02: HoursCommitsChart Summary

HoursCommitsChart — full-width dual-Y-axis ComposedChart (hours blue/left, commits green/right) for a rolling 7-day Tempo + GitLab activity view, with honest zero-states and today pill highlighting.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| RED  | Failing tests for data layer + render states | 860537c2 | HoursCommitsChart.test.tsx |
| 1+2  | Data layer + render layer implementation | 2a6bb2d5 | HoursCommitsChart.tsx + test (biome fix) |

## What Was Built

### HoursCommitsChart.tsx

Full-width `<Card>` wrapping a Recharts `ComposedChart` with:

**Data layer (Task 1):**
- `buildRolling7Buckets(worklogs, commitsByDay, todayDate)` — exported named function; 7 `DayBucket` objects with `{day, label, isToday, hours, commits}`; label via `new Date(${day}T12:00:00).toLocaleDateString('en-US', { weekday:'short' })` (noon to dodge DST); hours bucketed by `wl.dateStarted === b.day` string equality (pre-normalized YYYY-MM-DD from `fetchWorklogs`); commits from caller-supplied `Map<string,number>`
- `addDays()` inlined from `dashboardMetrics.ts:159-163` — uses `Date.UTC` arithmetic, one sanctioned `toISOString()` to read back the UTC-constructed Date (DST-immune)
- `getTodayDate()` / `getRolling7Days()` using `en-CA` locale (never `toISOString()`)
- Tempo `useQuery` keyed `['dashboard','tempo-7day',jiraBaseUrl,todayDate,jiraUsername]` — auto-rotates at midnight
- GitLab `useQueries` x 7 with VERBATIM ActivityStrip cache key `['standup','commits',gitlabBaseUrl,activeGitlabProject,day,gitlabUsername||gitlabName||'']` — warm-cache-shares with ActivityStrip/StandupNotes

**Render layer (Task 2):**
- Card shell: `role="region" aria-label="Past 7 days hours and commits"`
- Header: `flex items-center justify-between` — title left, totals (`{formatHoursMinutes(totalHours)} h logged` + `{totalCommits} commits`) right in `var(--chart-1)` / `var(--chart-2)` colors
- `ComposedChart data={dayBuckets} responsive margin={{ top:24, right:40, left:0, bottom:0 }}`
- `<YAxis yAxisId="hours" orientation="left">` + `<YAxis yAxisId="commits" orientation="right">` — both Bar elements carry matching `yAxisId` strings (RESEARCH pitfall mitigated)
- `<ReferenceLine yAxisId="hours" y={maxHours} strokeDasharray="4 4">` — dashed at daily max
- Hours `<Bar yAxisId="hours" isAnimationActive={false}>` with `<Cell>` today-stroke + `<LabelList position="top">` returning `'0h'` for zeros (D-12)
- Commits `<Bar yAxisId="commits" isAnimationActive={false} minPointSize={1}>` with matching cells + `<LabelList position="bottom">` returning `'0'` for zeros (D-12)
- `TodayAwareTick` custom X-axis tick: `<foreignObject>` pill (Assumption A2) with `bg-foreground text-background rounded-full` styling; plain `<text>` fallback for non-today ticks
- Loading: `<Skeleton>` inside explicit-height div (200ms-gated via `useDelayedLoading`)
- Error: `<ErrorState error={e} onRetry={refetch} viewName="Hours & Commits">`
- Tempo-off (D-12): early return with `<EmptyState icon={Timer} title="Tempo not connected">` — NOT triggered by all-zero data

### HoursCommitsChart.test.tsx

15 tests across 5 describe blocks:
- `buildRolling7Buckets — D-09`: 5 tests (7 buckets, last isToday, 6 not isToday, date coverage, weekday labels)
- `buildRolling7Buckets — D-11`: 4 tests (string equality bucketing, out-of-window ignored, commitsByDay map, multi-worklog accumulation)
- `buildRolling7Buckets — D-12`: 1 test (all-zero input = all hours:0 commits:0)
- `HoursCommitsChart — D-12 tempo-off`: 2 tests (renders "Tempo not connected", no chart element)
- `HoursCommitsChart — D-12 zero-week`: 2 tests (ChartContainer present, no EmptyState)
- `HoursCommitsChart — render`: 1 test (ChartContainer present with warm cache)

## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (test) | 860537c2 | PASSED — failed due to missing import (HoursCommitsChart.tsx not created yet) |
| GREEN (feat) | 2a6bb2d5 | PASSED — all 15 tests pass |
| REFACTOR | skipped — no structural cleanup needed | N/A |

## Acceptance Criteria Verification

| Criterion | Result |
|-----------|--------|
| Tests exit 0 | PASS — 15/15 |
| 7 buckets, last isToday, all-zero yields hours:0/commits:0 | PASS |
| `grep -c "tempo-7day"` >= 1 | PASS (2) |
| `grep -c "standup"` >= 1 | PASS (2) |
| `toISOString` only in addDays (Date.UTC) — no bucketing use | PASS |
| First line: `'use no memo';` | PASS |
| `grep -c "ComposedChart"` >= 1 | PASS (5) |
| `grep -c "isAnimationActive={false}"` >= 2 | PASS (3 total, 2 JSX) |
| `grep -c "yAxisId"` >= 4 | PASS (6) |
| `grep -c "dangerouslySetInnerHTML"` = 0 (T-86-04) | PASS (0) |
| `npm run check` GREEN | PASS (0 errors, 25 pre-existing warnings) |

## Security Compliance

| Threat | Status |
|--------|--------|
| T-86-04: No dangerouslySetInnerHTML | PASS — 0 occurrences |
| T-86-05: No token/pat/secret in queryKey | PASS — tokens only in queryFn closures |
| T-86-06: 7 parallel GitLab calls bounded | Accepted — warm-cache sharing with ActivityStrip |

## Deviations from Plan

None — plan executed exactly as written.

The `@ts-expect-error` on the `xmlns` prop in `TodayAwareTick`'s `foreignObject` div is a minor TypeScript annotation for a valid HTML attribute — not a functional deviation.

## Known Stubs

None — component is fully wired to real `fetchWorklogs` and `fetchUserCommits` queries. Visual correctness in Tauri WebKit (foreignObject Assumption A2, `responsive` on ComposedChart Assumption A1) deferred to Plan 04 UAT as designed.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. Existing query patterns reused.

## Self-Check: PASSED

- `taskflow/src/routes/dashboard/HoursCommitsChart.tsx` — FOUND
- `taskflow/src/routes/dashboard/HoursCommitsChart.test.tsx` — FOUND
- Commit 860537c2 (RED test) — FOUND
- Commit 2a6bb2d5 (feat implementation) — FOUND
- `npm run test -- src/routes/dashboard/HoursCommitsChart` — 15 passed
- `npm run check` — 0 errors
