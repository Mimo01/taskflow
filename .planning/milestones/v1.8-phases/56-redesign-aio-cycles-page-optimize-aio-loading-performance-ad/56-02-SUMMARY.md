---
phase: 56
plan: "02"
subsystem: aio
tags: [progressive-loading, per-row-query, skeleton, test-coverage, credential-migration]
dependency_graph:
  requires:
    - taskflow/src/hooks/useAioCredentials.ts
    - taskflow/src/lib/aioUtils.ts
  provides:
    - taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx (4-column layout + CycleStatsCell)
    - taskflow/src/routes/dashboard/AioCyclesSkeleton.tsx (4-column structured skeleton)
    - taskflow/src/routes/dashboard/AioProjectOverviewPage.test.tsx (9 tests, 6 new AION-03)
  affects:
    - taskflow/src/routes/dashboard/AioCycleDetailPage.tsx (cache-key shared via runs query)
tech_stack:
  added: []
  patterns:
    - "CycleStatsCell: token + tokenLoading prop-drilled from page, no hook duplication (D-16)"
    - "Per-row useQuery with queryKey ['aio', jiraBaseUrl, 'runs', projectKey, cycleKey] — cache shared with cycle detail"
    - "Progressive rendering: cycle list appears immediately; stats cells load independently"
    - "Zero-state: empty run array renders 'No runs' text, not a ghost bar"
    - "Error boundary per cell: runQuery.isError renders — without breaking the row"
key_files:
  created: []
  modified:
    - taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx
    - taskflow/src/routes/dashboard/AioCyclesSkeleton.tsx
    - taskflow/src/routes/dashboard/AioProjectOverviewPage.test.tsx
decisions:
  - "Token prop-drilled to CycleStatsCell (not hook called inside): per D-16 and Pitfall 6, calling useAioCredentials() inside each row component would issue N Stronghold reads per render cycle; one call at page level + prop-drill is correct"
  - "No runs zero-state retained as specified: empty array renders loaded div with 'No runs' text, preventing empty 1px ghost bar on the progress column"
  - "Test file retains stronghold mock rather than switching to useAioCredentials mock: the existing vi.mock('@/services/stronghold') continues to work because useAioCredentials reads readSecret internally, and the existing waitFor pattern tolerates the extra async tick from isLoading=true → false"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-14T21:05:00Z"
  tasks_completed: 2
  files_created: 0
  files_modified: 3
  tests_added: 6
---

# Phase 56 Plan 02: Cycles Page 4-Column Progress Layout Summary

**One-liner:** Added per-row progressive stats loading to AioProjectOverviewPage with CycleStatsCell sub-component, updated AioCyclesSkeleton to 4-column structured layout, and extended test coverage to 9 tests covering all AION-03 scenarios.

## What Was Built

### CycleStatsCell sub-component (D-01, D-02, D-03, D-04)

`CycleStatsCell` is a local sub-component inside `AioProjectOverviewPage.tsx`. Signature:

```typescript
function CycleStatsCell({
  projectKey, cycleKey, jiraBaseUrl, token, tokenLoading
}: { projectKey: string; cycleKey: string; jiraBaseUrl: string | undefined; token: string | null; tokenLoading: boolean })
```

- Fires one `useQuery` per cycle row using key `['aio', jiraBaseUrl, 'runs', projectKey, cycleKey]`
- This key aligns exactly with `AioCycleDetailPage`'s run query — navigating to cycle detail renders instantly from cache
- Loading state: two stacked skeletons (`h-1.5` bar + `h-3` counts) with `data-testid="cycle-stats-loading"`
- Error state: `—` fallback with `data-testid="cycle-stats-error"` — row itself stays intact
- Zero-runs state: `data-testid="cycle-stats-loaded"` with "No runs" text, no empty bar
- Loaded state: `h-1.5` mini bar with green-500/red-500/orange-400/bg-muted segments + `{N}P {N}F {N}B {N}N` counts paragraph

### Decision: Token prop-drilled (D-16 / Pitfall 6)

`token` and `tokenLoading` are called once via `useAioCredentials()` at the `AioProjectOverviewPage` level and prop-drilled to each `CycleStatsCell`. This avoids N Stronghold reads (one per row) that would occur if `useAioCredentials()` were called inside the sub-component. The enabled guard in `CycleStatsCell` follows the required order: `!!jiraBaseUrl && !!token && !tokenLoading`.

### Credential migration

Replaced the inline `useState<string|null> + useEffect + readSecret` block (7 lines) with:
```typescript
const { token, isLoading: tokenLoading } = useAioCredentials();
```

Top-level cycles query `enabled` guard updated to include `!tokenLoading`:
```typescript
enabled: !!jiraBaseUrl && !!token && !tokenLoading && !!projectKey,
```

### Updated AioCyclesSkeleton

Replaced flat `h-10 w-full` bars with 4-column structured rows:

| Column | Skeleton size |
|--------|---------------|
| Key    | h-4 w-20 shrink-0 |
| Name   | h-4 flex-1 |
| Status | h-5 w-20 shrink-0 |
| Progress (bar) | h-1.5 w-full rounded-full |
| Progress (counts) | h-3 w-24 |

Each row wrapped in `flex items-center gap-3 border-b border-border px-3 py-3` — matching the loaded table row spacing exactly to eliminate layout jump.

### Test coverage delta

| Describe block | Before | After |
|---------------|--------|-------|
| AioProjectOverviewPage | 3 | 3 |
| AION-03: per-row stats | 0 | 6 |
| **Total** | **3** | **9** |

New AION-03 tests:
1. Renders Progress column header
2. Shows loading skeleton while runs query is pending (never-resolving promise)
3. Shows `{N}P {N}F {N}B {N}N` counts format once runs resolve (2P 1F 1B 1N for 5-run fixture)
4. Shows "No runs" zero-state for empty array
5. Renders `—` error fallback without breaking the cycle row
6. Confirms `fetchAioTestRunsForCycle` called with exact args `(baseUrl, token, projectKey, cycleKey)` — cache-key alignment invariant

## Deviations from Plan

None — plan executed exactly as written.

## Threat Flags

None — token is not added to any queryKey, not serialized to data-* attributes, and no new network endpoints are introduced beyond what the threat model covers (T-56-02-01 verified: token only appears as a JS prop, not in JSX attributes).

## Known Stubs

None — CycleStatsCell is fully wired to `fetchAioTestRunsForCycle` and `normalizeStatus`. No placeholder text in data paths.

## Self-Check: PASSED

- [x] `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx` modified — contains `CycleStatsCell`, `useAioCredentials`, `fetchAioTestRunsForCycle`, `normalizeStatus`, `data-testid="cycle-stats-loading"`, `data-testid="cycle-stats-loaded"`, 4 color classes
- [x] `taskflow/src/routes/dashboard/AioCyclesSkeleton.tsx` modified — 5 Skeleton elements per row, `h-1.5 w-full rounded-full` present
- [x] `taskflow/src/routes/dashboard/AioProjectOverviewPage.test.tsx` modified — 9 total `it(` cases, `fetchAioTestRunsForCycle` mock present
- [x] Commit 249eb35 exists (Task 1 — page layout + CycleStatsCell)
- [x] Commit e2e757c exists (Task 2 — skeleton + tests)
- [x] `npx tsc --noEmit` reports 0 errors for AioProjectOverviewPage
- [x] All 9 AioProjectOverviewPage tests pass
- [x] Full suite: 1071 tests pass, zero failures
