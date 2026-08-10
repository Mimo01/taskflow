---
phase: 83
plan: "02"
subsystem: dashboard
tags: [ui-components, recharts, tanstack-query, warm-cache, donut-chart, stat-tiles, tdd, accessibility]
dependency_graph:
  requires:
    - dashboardMetrics.ts (plan 83-01 — pure derivation functions consumed here)
    - Sidebar active-sprint prefetch (plan 83-01 — D-10 Option B warmup)
  provides:
    - StatTile.tsx (static display tile with role=region, aria-label, no interactive affordances)
    - SprintHealthSection.tsx (days-remaining + progress bar + donut, warm-cache sourced)
  affects:
    - taskflow/src/routes/dashboard/ (two new components + two new test files)
tech_stack:
  added: []
  patterns:
    - Static display-only tile with role=region a11y semantics (no role=button, no cursor-pointer)
    - Warm-cache PieChart donut via enabled:false useQuery (reactive read, zero new API calls)
    - ChartWrapper independent degradation (loading/error/empty each handled separately)
    - Cache-seeded QueryClient test pattern (setQueryData before render, no network mocks needed)
key_files:
  created:
    - taskflow/src/routes/dashboard/StatTile.tsx
    - taskflow/src/routes/dashboard/StatTile.test.tsx
    - taskflow/src/routes/dashboard/SprintHealthSection.tsx
    - taskflow/src/routes/dashboard/SprintHealthSection.test.tsx
  modified: []
decisions:
  - "enabled:false for active-sprint useQuery confirmed — Sidebar D-10 Option B cache is warm at render time; zero new API calls"
  - "queryClient.getQueryData NOT used in render — fetch-disabled useQuery with enabled:false is the reactive pattern (project memory: reactive-cache-read)"
  - "node_modules symlink recreated for worktree (same as 83-01) — no_modules in worktree, symlink to main repo required for vitest to resolve"
  - "Progress bar tested via data-slot=progress (base-ui attribute) not role=progressbar — base-ui Progress uses ProgressPrimitive.Root which does expose progressbar but inside a wrapper; asserting the slot is more robust"
metrics:
  duration: "~15 minutes"
  completed: "2026-06-15"
  tasks_completed: 2
  files_changed: 4
---

# Phase 83 Plan 02: StatTile + SprintHealthSection Summary

**One-liner:** Static `StatTile` display component (role=region, no interactive affordances) and `SprintHealthSection` reading the warm sprint-board + active-sprint caches to render days-remaining, progress bar, and a Recharts PieChart donut with independent loading/error/empty degradation via `ChartWrapper`.

## What Was Built

### Task 1: StatTile.tsx + StatTile.test.tsx

Created `taskflow/src/routes/dashboard/StatTile.tsx` — a pure display component. Props: `{ label, value, icon: LucideIcon, iconClass?, valueClass? }`.

Key implementation choices per UI-SPEC and D-06:
- Root: `<div role="region" aria-label={label}>` — screen readers navigate to each tile as a landmark
- Value: `<p aria-label="{value} {label}">` — reads "4 Open", not just "4"
- No `role="button"`, no `cursor-pointer`, no `hover:bg-*`, no `onClick` — static display only
- `'use no memo'` directive at top (React Compiler compatibility, established project pattern)

Test suite (`StatTile.test.tsx`) — 11 tests across 4 describe blocks:
- Label and value render
- Accessibility semantics: `role="region"`, `aria-label`, value `aria-label="{value} {label}"`
- D-06 static guard: `queryByRole('button')` is null, no `cursor-pointer` in HTML, no `[onclick]`
- Optional props: `iconClass` applied via `getAttribute('class')` (SVGAnimatedString workaround), `valueClass` applied to value element

**Deviation (Rule 1 — Bug fix in test):** SVG elements in jsdom expose `className` as an `SVGAnimatedString` (not a regular string). Initial test used `icon?.className`, which failed. Fixed to `icon?.getAttribute('class')` — same assertion, correct jsdom API.

### Task 2: SprintHealthSection.tsx + SprintHealthSection.test.tsx

Created `taskflow/src/routes/dashboard/SprintHealthSection.tsx`. Props: `{ jiraBaseUrl, jiraToken, activeJiraProject, storyPointsFieldKey, boardId }`.

Two useQuery calls:
1. Sprint-board issues: `queryKey: ['jira-issues', 'sprint-board', activeJiraProject, storyPointsFieldKey]`, `staleTime: 30_000`, `enabled: !!jiraBaseUrl && !!jiraToken && !!activeJiraProject` — reads the warm cache shared with SprintBoardTab
2. Active-sprint: `queryKey: ['jira-active-sprint', activeJiraProject, jiraBaseUrl, boardId]`, `enabled: false` — reactive read of the Sidebar D-10 Option B prefetch; zero new API calls

Metrics derived exclusively via `dashboardMetrics.ts`:
- `computeSpTotal(sprintIssues, storyPointsFieldKey)` → `totalSP`
- `computeSpDone(sprintIssues, storyPointsFieldKey)` → `donePoints`
- `computeDonutData(sprintIssues, storyPointsFieldKey)` → `donutData`
- `getDaysRemaining(activeSprint?.endDate)` → `daysLeft`

Rendering structure:
- Empty state: `EmptyState icon=Activity title="No active sprint"` when `!showSkeleton && !activeSprint`
- Days remaining: `"Sprint ends today"` / `"N day[s] remaining"` via the getDaysRemaining contract
- Progress bar: `Progress value={donePct}` + caption `"{N}% complete · {done} / {total} pts"`
- Donut: `ChartWrapper height={200}` wrapping `ChartContainer + PieChart responsive` + `Pie innerRadius="60%" outerRadius="80%" isAnimationActive={false}` — uses `var(--chart-1..3)`, no hardcoded hex
- Donut center: absolute overlay div with `data-testid="donut-center-value"` for testability

Test suite (`SprintHealthSection.test.tsx`) — 10 tests across 3 describe blocks:
- Warm cache with sprint data: donut renders `[data-slot="chart"]`, progress bar `[data-slot="progress"]`, days-remaining copy, `"Sprint ends today"`, progress caption `50% complete`, subtask exclusion guard
- DASH-07 empty state degradation: EmptyState `"No active sprint"` when cache is null, EmptyState body copy, ChartWrapper `"No data yet"` when totalSP=0
- Region accessibility: `role="region"` with `aria-label="Sprint health"`

Cache-seeding test pattern: `QueryClient.setQueryData()` pre-seeds both cache slots before render — no network mocks needed, pure warm-cache behavior exercised in jsdom.

## Verification Results

| Check | Result |
|-------|--------|
| `npm run test -- StatTile --run` | 11/11 passed |
| `npm run test -- SprintHealthSection --run` | 10/10 passed |
| `npm run test -- dashboardMetrics --run` | 22/22 passed (no regression) |
| Cache key matches sacred key | PASS — `['jira-issues','sprint-board',activeJiraProject,storyPointsFieldKey]` |
| `staleTime: 30_000` on sprint-board query | PASS |
| `enabled: false` on active-sprint query | PASS |
| No `queryClient.getQueryData` in render | PASS — only in comments |
| `isAnimationActive={false}` | PASS |
| `<PieChart responsive` | PASS |
| No `ResponsiveContainer` import | PASS |
| No hardcoded hex in chart code | PASS — all `var(--chart-N)` |
| `[data-slot="chart"]` asserted in test | PASS |
| EmptyState "No active sprint" asserted | PASS |
| No `role="button"` in StatTile | PASS (only in doc comment) |
| No `cursor-pointer` in StatTile | PASS (only in doc comment) |
| `role="region"` in StatTile | PASS |
| Value `aria-label="{value} {label}"` | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed SVGAnimatedString className access in StatTile test**
- **Found during:** Task 1 verification (1 failing test out of 11)
- **Issue:** Test `applies iconClass to the icon element` queried `icon?.className` on an SVG element. In jsdom, SVG `className` is an `SVGAnimatedString` object, not a regular string, so `.toContain('text-destructive')` always failed
- **Fix:** Changed to `icon?.getAttribute('class')` which returns the raw class string in jsdom
- **Files modified:** `StatTile.test.tsx`
- **Commit:** `eaa5fa84` (folded into Task 1 commit after fix)

**2. [Infrastructure] node_modules symlink recreated for worktree**
- Same as 83-01: worktree's `taskflow/` has no `node_modules`; created symlink to main repo's `node_modules` to allow vitest to resolve. No production code affected.

## Known Stubs

None. Both components are fully implemented with complete warm-cache reads, all metric derivations, and independent degradation states. No data is hardcoded or mocked in production code.

## Threat Flags

None. Components read exclusively from the authenticated TanStack Query warm cache (no new network endpoints). All Jira text rendered via JSX auto-escaping. Cache key includes `activeJiraProject` — no cross-project data leak (T-83-03 mitigated). No `dangerouslySetInnerHTML` (T-83-04 mitigated).
