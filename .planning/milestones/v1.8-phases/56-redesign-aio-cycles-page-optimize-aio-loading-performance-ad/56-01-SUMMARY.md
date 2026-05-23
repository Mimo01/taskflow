---
phase: 56
plan: "01"
subsystem: aio
tags: [hook, shared-util, credential-loading, refactor]
dependency_graph:
  requires: []
  provides:
    - taskflow/src/hooks/useAioCredentials.ts
    - taskflow/src/lib/aioUtils.ts
  affects:
    - taskflow/src/routes/dashboard/AioTestRunDetailPage.tsx
tech_stack:
  added: []
  patterns:
    - "useAioCredentials(): { token, isLoading } — shared credential hook with isLoading=true default"
    - "!tokenLoading guard in useQuery.enabled to prevent flash-fire-with-null-token"
    - "normalizeStatus + normalizeStatusLabel extracted to @/lib/aioUtils"
key_files:
  created:
    - taskflow/src/hooks/useAioCredentials.ts
    - taskflow/src/hooks/useAioCredentials.test.ts
    - taskflow/src/lib/aioUtils.ts
    - taskflow/src/lib/aioUtils.test.ts
  modified:
    - taskflow/src/routes/dashboard/AioTestRunDetailPage.tsx
decisions:
  - "AioTestRunDetailPage.test.tsx left unmodified — vi.mock('@/services/stronghold') continues to work because useAioCredentials calls readSecret internally; existing waitFor blocks tolerate the extra microtask from isLoading=true initial state"
  - "AioCycleDetailPage.tsx local normalizeStatus/normalizeStatusLabel NOT removed in this plan — Plan 03 owns that file and will do its own swap to avoid wave-2 file overlap"
  - "useAioCredentials placed in src/hooks/ with no barrel export — consistent with existing hook convention (no index.ts in hooks/)"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-14T18:52:51Z"
  tasks_completed: 3
  files_created: 4
  files_modified: 1
  tests_added: 16
---

# Phase 56 Plan 01: useAioCredentials Hook + aioUtils Extraction Summary

**One-liner:** Extracted shared `useAioCredentials()` hook with `isLoading` guard and `normalizeStatus`/`normalizeStatusLabel` utils from duplicate inline implementations across three AIO pages.

## What Was Built

### useAioCredentials hook (D-14, D-15)

`taskflow/src/hooks/useAioCredentials.ts` exports:

```typescript
function useAioCredentials(): { token: string | null; isLoading: boolean }
```

- `isLoading` starts as `true` — the guard is closed until Stronghold resolves or rejects
- `readSecret('jira-pat')` called once per hook instance (empty deps `[]`)
- `.catch(() => setToken(null)).finally(() => setIsLoading(false))` — both error and success paths flip the gate
- No console.log/error of token value (T-56-01-01 compliance)
- Token never added to any queryKey array

**How Plans 02/03 should consume it:**

```typescript
const { token, isLoading: tokenLoading } = useAioCredentials();
// In useQuery:
enabled: !!jiraBaseUrl && !!token && !tokenLoading && /* other guards */
```

The `!tokenLoading` term must appear immediately after `!!token`. Props from the page to sub-components should pass `token` and `tokenLoading` if sub-components fire their own queries — they should NOT call `useAioCredentials()` again per D-16.

### aioUtils.ts

`taskflow/src/lib/aioUtils.ts` exports two pure functions:

- `normalizeStatus(raw)`: `PASS`→`'pass'`, `FAIL`→`'fail'`, `BLOCKED`→`'blocked'`, anything else→`'notRun'`
- `normalizeStatusLabel(raw)`: `PASS`→`'Pass'`, `FAIL`→`'Fail'`, `BLOCKED`→`'Blocked'`, `NOT_EXECUTED`→`'Not Run'`, unknown→original value or `'Not Run'`

Both are confirmed sourced from `AioCycleDetailPage.tsx` lines 19-45 verbatim. No React imports. No side effects.

### AioTestRunDetailPage migration

Replaced inline `useState<string|null>(null) + useEffect + readSecret` with `useAioCredentials()`. The `enabled` clause now reads:

```typescript
enabled: !!jiraBaseUrl && !!token && !tokenLoading && !!projectKey && !!cycleKey && !!runId,
```

## Test Results

| File | Tests | Status |
|------|-------|--------|
| useAioCredentials.test.ts | 4 | All pass |
| aioUtils.test.ts | 12 | All pass |
| AioTestRunDetailPage.test.tsx | 5 (existing) | All pass, unmodified |
| **Total** | **21** | **All pass** |

## Decision: AioTestRunDetailPage.test.tsx Left Unmodified

The existing test file mocks `@/services/stronghold` at module level:
```typescript
vi.mock('@/services/stronghold', () => ({ readSecret: vi.fn().mockResolvedValue('fake-token') }))
```

Because `useAioCredentials` calls `readSecret` internally, this mock continues to satisfy the hook's internal fetch. The existing `waitFor` blocks already tolerate async resolution — the extra microtask from `isLoading: true → false` does not cause any timing failures. No change to the test file was needed.

## Deviations from Plan

None — plan executed exactly as written. The only editorial decision was using `async/await import` (ESM) instead of CommonJS `require()` in the test for the "initial render" case, since the project uses ES modules throughout.

## Threat Flags

None found — token does not appear in any queryKey literal, no console.log of token value in hook source.

## Known Stubs

None — all functions are fully implemented with real logic.

## Self-Check: PASSED

- [x] `taskflow/src/hooks/useAioCredentials.ts` exists
- [x] `taskflow/src/hooks/useAioCredentials.test.ts` exists (4 tests)
- [x] `taskflow/src/lib/aioUtils.ts` exists
- [x] `taskflow/src/lib/aioUtils.test.ts` exists (12 tests)
- [x] Commit 517b738 exists (Task 1)
- [x] Commit d73a605 exists (Task 2)
- [x] Commit 5e5efeb exists (Task 3)
- [x] `grep -c "readSecret" AioTestRunDetailPage.tsx` → 0
- [x] `grep -c "useAioCredentials" AioTestRunDetailPage.tsx` → 2
- [x] `grep "queryKey.*token"` → 0 lines
