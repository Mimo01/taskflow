---
phase: 84-dashboard-trend-chart-mr-review-queue-and-activity-strip
plan: "02"
subsystem: dashboard
tags: [weekly-trend-chart, mr-review-queue, recharts, tanstack-query, warm-cache, tdd, phase81-rules]
dependency_graph:
  requires: [84-01]
  provides: [WeeklyTrendChart, MrReviewQueue]
  affects: [dashboard/index.tsx]
tech_stack:
  added: []
  patterns:
    - Phase 81 chart rules (responsive prop, isAnimationActive=false, var(--chart-N) colors, explicit-height outer div)
    - overlay-button-sibling pattern for nested interactive elements
    - props-only auth (D-16) — auth values from index.tsx, not useAuthStore/readSecret in component
    - warm-cache sharing: MrReviewQueue uses exact ['gitlab-mrs', gitlabBaseUrl, userId] key as MrHealthPanel
key_files:
  created:
    - taskflow/src/routes/dashboard/WeeklyTrendChart.tsx
    - taskflow/src/routes/dashboard/WeeklyTrendChart.test.tsx
    - taskflow/src/routes/dashboard/MrReviewQueue.tsx
    - taskflow/src/routes/dashboard/MrReviewQueue.test.tsx
  modified: []
decisions:
  - tempo-off-empty-state-bypass-chartwrapper: ChartWrapper's isEmpty renders a hardcoded "No data yet" message. To render "Tempo not connected" (plan requirement), WeeklyTrendChart branches before ChartWrapper when tempoEnabled=false and renders the card shell with a custom EmptyState directly. When tempoEnabled=true, ChartWrapper is used with isEmpty=false always (Pitfall 6: all-zero weeks are valid data).
  - plug-not-plugin-icon: PATTERNS.md specified `Plugin` icon from lucide-react for the GitLab-not-connected EmptyState. `Plugin` does not exist in the installed version — the correct icon is `Plug`. Auto-fixed (Rule 1).
  - node-modules-symlink-for-worktree-tests: Worktree has no node_modules. Symlinked main taskflow/node_modules into worktree taskflow to enable vitest to resolve packages during test execution. The symlink is not committed (worktree-local filesystem artifact).
metrics:
  duration: "~40m"
  completed: "2026-06-15T15:21:00Z"
  tasks: 2
  files: 4
---

# Phase 84 Plan 02: WeeklyTrendChart + MrReviewQueue Summary

Tempo bar chart (DASH-04) and two-group MR review queue (DASH-06) built as independent props-only components following Phase 81 chart rules and MrHealthPanel cache-sharing pattern.

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | WeeklyTrendChart.tsx — Mon–Fri Tempo bar chart with 8h ReferenceLine + test | 9adb1381 | WeeklyTrendChart.tsx, WeeklyTrendChart.test.tsx |
| 2 | MrReviewQueue.tsx — two-group MR queue from warm cache + test | 57b61ee5 | MrReviewQueue.tsx, MrReviewQueue.test.tsx |
| fix | Biome import order + formatting in WeeklyTrendChart | 424d127d | WeeklyTrendChart.tsx |

## What Was Built

**`WeeklyTrendChart.tsx`** — Mon–Fri BarChart of Tempo-logged hours with a fixed 8h/day `ReferenceLine`. Props-only (D-16): `{ jiraBaseUrl, jiraToken, jiraUsername, tempoEnabled }`. Fires ONE new fetch (`['dashboard','tempo-week', jiraBaseUrl, weekStartDate, jiraUsername]`) gated by `tempoEnabled` — jiraToken in queryFn closure, never in queryKey (T-84-02). When `tempoEnabled=false`, renders "Tempo not connected" EmptyState (not an error). When `tempoEnabled=true` with empty worklogs, renders all-zero bars (Pitfall 6). Phase 81 rules: `responsive` prop, `isAnimationActive={false}`, `var(--chart-N)` colors, explicit-height outer `<div>`, `'use no memo'`. Week boundaries derived via `toLocaleDateString('en-CA')` — never `toISOString()` (UTC-shift guard). 4 tests.

**`MrReviewQueue.tsx`** — Two non-overlapping MR groups derived client-side from the warm `['gitlab-mrs', gitlabBaseUrl, userId]` cache. Cache key matches `MrHealthPanel` exactly — no duplicate fetch (DASH-06 D-13). `groupMrsByRole` from `dashboardMetrics` handles grouping — never inlined (Pitfall 3: self-authored excluded from "Awaiting my review"). Per-MR health read imperatively via `queryClient.getQueryData(['mr-health', project_id, iid])` with dot+text badges (never color alone). MR row uses overlay-button-sibling pattern. External links via `openUrl` from `@tauri-apps/plugin-opener` (never `window.open`). Three context-aware empty states: tokenLoading skeleton, "GitLab not connected", "No MRs awaiting review". 12 tests.

## Verification Results

- `npx vitest run WeeklyTrendChart.test.tsx MrReviewQueue.test.tsx` — 16/16 GREEN
- `npm run check` — 0 errors, 23 warnings (3 new a11y `useSemanticElements` warnings at `"warn"` level, matching existing `SprintHealthSection` pattern)
- Grep gates all clean: no `ResponsiveContainer`, no hex colors, no `toISOString()`, no `jiraToken` in queryKey, no `window.open`, `isAnimationActive={false}` present

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `Plugin` icon does not exist in installed lucide-react version**
- **Found during:** Task 2 (test run showed "Element type is invalid: expected a string or function but got undefined")
- **Issue:** PATTERNS.md specified `import { Plugin } from 'lucide-react'` for the GitLab-not-connected EmptyState. The installed lucide-react does not export `Plugin` — the correct icon is `Plug`.
- **Fix:** Changed import to `Plug` throughout MrReviewQueue.tsx
- **Files modified:** `MrReviewQueue.tsx`
- **Commit:** 57b61ee5

**2. [Rule 2 - Missing functionality] ChartWrapper empty state does not support custom title**
- **Found during:** Task 1 (test expected "Tempo not connected" but ChartWrapper renders hardcoded "No data yet")
- **Issue:** Plan says `isEmpty={!tempoEnabled}` via ChartWrapper, but ChartWrapper's EmptyState is hardcoded to "No data yet". The plan requires the "Tempo not connected" copy (test-verified).
- **Fix:** When `tempoEnabled=false`, WeeklyTrendChart branches before ChartWrapper and renders the card shell + custom EmptyState directly. When `tempoEnabled=true`, ChartWrapper is used with `isEmpty=false` always (Pitfall 6 preserved).
- **Files modified:** `WeeklyTrendChart.tsx`
- **Commit:** 9adb1381

**3. [Rule 3 - Blocking] Worktree has no node_modules for vitest**
- **Found during:** Task 1 RED phase (vitest could not resolve `@tanstack/react-query`)
- **Issue:** Worktree shares git but has no `node_modules/`. Running `npx vitest` from worktree failed because vite-temp cached in worktree's non-existent `node_modules`.
- **Fix:** Created a symlink `worktree/taskflow/node_modules → main/taskflow/node_modules`. Not committed (worktree-local filesystem only).
- **Files modified:** none

## Known Stubs

None — both components are fully wired. WeeklyTrendChart fetches live Tempo data; MrReviewQueue reads from the warm gitlab-mrs cache.

## Threat Flags

No new threat surface beyond what was documented in the plan's threat model. All network access goes through existing `fetchWorklogs`, `fetchAssignedMRs`, `fetchReviewerMRs`. External browser links use Tauri `openUrl` (T-84-03 accepted).

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| WeeklyTrendChart.tsx | FOUND |
| WeeklyTrendChart.test.tsx | FOUND |
| MrReviewQueue.tsx | FOUND |
| MrReviewQueue.test.tsx | FOUND |
| 84-02-SUMMARY.md | FOUND |
| Commit 9adb1381 (WeeklyTrendChart) | VERIFIED |
| Commit 57b61ee5 (MrReviewQueue) | VERIFIED |
| Commit 424d127d (biome format fix) | VERIFIED |
| 16 tests GREEN | VERIFIED |
| 0 biome errors | VERIFIED |
