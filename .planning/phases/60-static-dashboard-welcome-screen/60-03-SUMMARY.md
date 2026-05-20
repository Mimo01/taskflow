---
phase: 60-static-dashboard-welcome-screen
plan: "03"
subsystem: dashboard
tags: [dashboard, release-card, jira, tdd, vitest]
dependency_graph:
  requires:
    - taskflow/src/services/jira.ts (fetchFixVersions, JiraFixVersion)
    - taskflow/src/components/ui/badge.tsx (Badge with tone prop)
    - taskflow/src/hooks/useDelayedLoading.ts
    - taskflow/src/routes/dashboard/ReleasesTab.tsx (getReleaseTimingLabel logic — copied verbatim)
  provides:
    - taskflow/src/routes/dashboard/DashboardReleaseCard.tsx (DashboardReleaseCard default export)
    - taskflow/src/routes/dashboard/DashboardReleaseCard.test.tsx (5 DASH-04 unit tests)
  affects:
    - taskflow/src/routes/dashboard/index.tsx (plan 60-04 will wire this card in)
tech_stack:
  added: []
  patterns:
    - TDD RED/GREEN cycle (Vitest)
    - TanStack Query shared cache key with ReleasesTab
    - useDelayedLoading skeleton pattern
    - Props-only auth (D-16) — no readSecret, no useAuthStore in card
key_files:
  created:
    - taskflow/src/routes/dashboard/DashboardReleaseCard.tsx
    - taskflow/src/routes/dashboard/DashboardReleaseCard.test.tsx
  modified: []
decisions:
  - ascending-sort: Dashboard uses ascending releaseDate sort for soonest-first; ReleasesTab uses descending for newest-first (RESEARCH Pitfall 6)
  - verbatim-copy: getReleaseTimingLabel copied verbatim (not imported) to avoid coupling to a route component and circular-import risk
  - comment-only-mention: "readSecret/useAuthStore" appears only in JSDoc comment, never as a function call (D-16 satisfied)
metrics:
  duration: "133s"
  completed: "2026-05-21"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 60 Plan 03: DashboardReleaseCard Summary

**One-liner:** Next Release countdown card fetching Jira fix versions with ascending soonest-first sort, three timing states (today/overdue/future), and shared TanStack Query cache key with ReleasesTab.

## Tasks Completed

| Task | Name | Type | Commit | Files |
|------|------|------|--------|-------|
| 1 | Create DashboardReleaseCard test scaffold (TDD RED) | test | `62c8b32b` | `DashboardReleaseCard.test.tsx` |
| 2 | Implement DashboardReleaseCard component (TDD GREEN) | feat | `9f904e66` | `DashboardReleaseCard.tsx` |

## What Was Built

`DashboardReleaseCard` is a React component that:

1. Fetches Jira fix versions using `useQuery` with cache key `['jira-fix-versions', activeJiraProject]` — identical to ReleasesTab.tsx so both components share a single TanStack Query cache entry.
2. Sorts unreleased versions with a `releaseDate` **ascending** (soonest first) and picks index `[0]` — the opposite of ReleasesTab which sorts descending (newest first).
3. Renders three timing states using a local verbatim copy of `getReleaseTimingLabel`:
   - `releaseDate === today` → `<Badge tone="blue">Today</Badge>`
   - `releaseDate < today` → `<span className="text-amber-600 dark:text-amber-400">N days overdue</span>`
   - `releaseDate > today` → `<span className="text-sm text-muted-foreground">N days away</span>`
4. Renders `"No upcoming releases"` when no unreleased version with a `releaseDate` exists.
5. Applies `useDelayedLoading(isLoading)` with 3-block animated skeleton.
6. Receives all auth values as props — no `readSecret(`, no `useAuthStore(` call in the component (D-16).

The test file uses `vi.useFakeTimers()` + `vi.setSystemTime(new Date('2026-05-21T12:00:00Z'))` for deterministic timing math.

## Verification Results

```
npx vitest run src/routes/dashboard/DashboardReleaseCard.test.tsx
  ✓ Test 1 (soonest unreleased sort)
  ✓ Test 2 (overdue: 5 days overdue + amber class)
  ✓ Test 3 (today: Badge tone="blue" with data-slot="badge")
  ✓ Test 4 (future: 7 days away)
  ✓ Test 5 (empty state: No upcoming releases)
  5 passed (5)

npx tsc --noEmit  →  exit 0 (no errors)
```

Acceptance criteria checks:
- `grep -c "'jira-fix-versions', activeJiraProject"` → 2 (query + comment)
- `grep -c "localeCompare"` → 1
- `grep -c "readSecret(\|useAuthStore("` → 0
- `grep -c "text-amber-600 dark:text-amber-400"` → 1
- `grep -c 'tone="blue"'` → 1

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The component is fully wired: it fetches live data via `useQuery`, computes timing from the real system clock (mocked in tests via `vi.useFakeTimers`), and renders all three states plus the empty state. No hardcoded placeholders exist.

## Threat Flags

No new threat surface beyond what the threat model covers. The component:
- Never renders `jiraToken` to DOM (T-60-08 mitigated)
- Uses React JSX for `soonest.name` — auto-escaped, no `dangerouslySetInnerHTML` (T-60-09 mitigated)
- Uses `new Date().toISOString().slice(0, 10)` throughout — timezone-safe (T-60-10 mitigated)

## Self-Check: PASSED

- `taskflow/src/routes/dashboard/DashboardReleaseCard.tsx` — FOUND
- `taskflow/src/routes/dashboard/DashboardReleaseCard.test.tsx` — FOUND
- Commit `62c8b32b` — FOUND
- Commit `9f904e66` — FOUND
