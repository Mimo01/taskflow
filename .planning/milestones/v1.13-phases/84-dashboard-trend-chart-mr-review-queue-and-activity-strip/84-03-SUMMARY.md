---
phase: 84-dashboard-trend-chart-mr-review-queue-and-activity-strip
plan: "03"
subsystem: dashboard
tags: [activity-strip, cache-sharing, tanstack-query, independent-degradation, tdd]
dependency_graph:
  requires: ["84-01"]
  provides: ["ActivityStrip.tsx", "ActivityStrip.test.tsx"]
  affects: ["dashboard/index.tsx (integration, Plan 04)"]
tech_stack:
  added: []
  patterns:
    - "Byte-identical TanStack Query keys for cross-component cache sharing"
    - "useDelayedLoading for skeleton flash prevention"
    - "mergeActivityEntries delegation to dashboardMetrics (no inline sort)"
    - "Per-source independent ErrorState rendering (DASH-07)"
key_files:
  created:
    - taskflow/src/routes/dashboard/ActivityStrip.tsx
    - taskflow/src/routes/dashboard/ActivityStrip.test.tsx
  modified: []
decisions:
  - "Used <section> element instead of <div role='region'> to satisfy biome a11y/useSemanticElements rule"
  - "CAP=6 (within 5-7 range from spec); overflow derived via mergeActivityEntries with MAX_SAFE_INTEGER cap"
  - "Symlinked main repo node_modules into worktree taskflow dir to run vitest (worktrees share git but not node_modules)"
metrics:
  duration: "~25 minutes"
  completed: "2026-06-15"
  tasks_completed: 2
  files_changed: 2
---

# Phase 84 Plan 03: ActivityStrip — Shared-Key Jira+Commits Feed Summary

ActivityStrip compact activity feed using byte-identical TanStack Query keys to StandupNotesPage for zero-duplicate-request warm cache sharing, with per-source independent degradation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | ActivityStrip.tsx — shared-key Jira+commits feed | bad61610 | ActivityStrip.tsx |
| 2 | ActivityStrip.test.tsx — key-equality + interleave + cap + degradation tests | e52869c2 | ActivityStrip.test.tsx, ActivityStrip.tsx (biome fixes) |

## What Was Built

### ActivityStrip.tsx

Compact merged activity feed for the Dashboard. Key implementation details:

- **`'use no memo'`** on line 1 (React Compiler escape hatch)
- **yesterdayDate** computed via `new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA')` — never `toISOString()` (Pitfall 2)
- **Jira activity query key** exactly `['standup', 'jira', jiraBaseUrl, activeJiraProject, yesterdayDate, jiraUsername ?? '']` — byte-identical to StandupNotesPage lines 308-316
- **Commits query key** exactly `['standup', 'commits', gitlabBaseUrl, activeGitlabProject, yesterdayDate, gitlabUsername || gitlabName || '']` — sixth element is NOT gitlabUserId (Pitfall 1), byte-identical to StandupNotesPage self-user path
- **Tokens never in queryKey** — `jiraToken` / `gitlabToken` used only in `enabled` guards (T-84-02)
- **No `enabled:false`** on either query (D-09 — cold Dashboard load fetches)
- **`mergeActivityEntries`** from `dashboardMetrics.ts` — no inline sort/merge
- **CAP=6** with `+{overflow} more` non-expanding button (min-h-[32px] touch target)
- **Per-source independent ErrorState** — Jira error + commits success → commits still render; commits error + Jira success → Jira still renders. Only when both fail does a single unified ErrorState appear (DASH-07)
- **`<section>` element** with `aria-label="Recent activity"` (biome a11y rule)

### ActivityStrip.test.tsx (5 tests)

| Test | What it proves |
|------|----------------|
| criterion 2: cache reuse | queryFn spies not called when cache is pre-seeded with exact key arrays |
| newest-first ordering | commit at 12:00 appears before jira at 10:00 in DOM |
| +N more overflow | 8 entries seeded (4 commits + 4 jira) → "+2 more" renders |
| DASH-07 independent degradation | jira queryFn rejects, commits seeded → commit rows render, strip not blank |
| empty state | both sources return [] → EmptyState renders |

## Verification Results

```
vitest run src/routes/dashboard/ActivityStrip.test.tsx
  Test Files  1 passed (1)
  Tests       5 passed (5)
  Duration    663ms

npm run check
  Checked 480 files. No fixes applied.
  Found 20 warnings. (pre-existing, 0 errors)
```

Acceptance criteria checks:
- [x] File line 1 is exactly `'use no memo';`
- [x] Jira key literal: `'standup', 'jira', jiraBaseUrl, activeJiraProject, yesterdayDate, jiraUsername ?? ''`
- [x] Commits key sixth element: `gitlabUsername || gitlabName || ''` (not gitlabUserId)
- [x] `grep enabled:false` returns nothing
- [x] `grep toISOString` returns nothing
- [x] Neither queryKey contains jiraToken or gitlabToken
- [x] `mergeActivityEntries` used (not inline sort)
- [x] tsc: no ActivityStrip type errors

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Biome a11y violation: `<div role="region">` → `<section>`**
- **Found during:** Task 2, `npm run check`
- **Issue:** Biome `lint/a11y/useSemanticElements` flags `<div role="region">` — should use `<section>` element
- **Fix:** Replaced the outer `<div role="region">` with `<section>` in ActivityStrip.tsx
- **Files modified:** `taskflow/src/routes/dashboard/ActivityStrip.tsx`
- **Commit:** e52869c2

**2. [Rule 3 - Blocking] Worktree lacks node_modules for vitest**
- **Found during:** Task 2 test execution
- **Issue:** The worktree's `taskflow/` directory has no `node_modules/` — vitest couldn't load `@vitejs/plugin-react` or `vitest/config`
- **Fix:** Created a symlink: `taskflow/node_modules -> /Users/mimo/Documents/Projects/taskflow/taskflow/node_modules`
- **Files modified:** None (filesystem symlink only, not committed)
- **Note:** The symlink is expected in worktree environments sharing a monorepo; gitignored by default

## Known Stubs

None. ActivityStrip fetches real data and renders all states (loading, empty, error, data).

## Threat Flags

No new threat surface beyond what the plan's threat model covers. Both queryKeys confirmed token-free (T-84-02). All text rendered as JSX text nodes (T-84-04 — XSS via React escaping).
