---
phase: 56-redesign-aio-cycles-page-optimize-aio-loading-performance-ad
reviewed: 2026-05-14T20:01:45Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - taskflow/src/hooks/useAioCredentials.test.ts
  - taskflow/src/hooks/useAioCredentials.ts
  - taskflow/src/lib/aioUtils.test.ts
  - taskflow/src/lib/aioUtils.ts
  - taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx
  - taskflow/src/routes/dashboard/AioCycleDetailPage.tsx
  - taskflow/src/routes/dashboard/AioCyclesSkeleton.tsx
  - taskflow/src/routes/dashboard/AioProjectOverviewPage.test.tsx
  - taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx
  - taskflow/src/routes/dashboard/AioTestRunDetailPage.tsx
  - taskflow/src/services/aio/cycles.test.ts
  - taskflow/src/services/aio/cycles.ts
  - taskflow/src/services/aio/issue-runs.test.ts
  - taskflow/src/services/aio/issue-runs.ts
  - taskflow/src/services/aio/types.ts
findings:
  critical: 1
  warning: 3
  info: 1
  total: 5
status: issues_found
---

# Phase 56: Code Review Report

**Reviewed:** 2026-05-14T20:01:45Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Reviewed the AIO cycles page redesign and loading-performance optimisation covering the credential hook, utility normalizers, paginated service functions, two overview pages, and the run detail page. The folder-accordion approach in `AioProjectOverviewPage`, the credential guard pattern in `useAioCredentials`, and the status normalizers are sound. One critical infinite-loop bug was found in the pagination path of `fetchAioTestRunsForCycle` that mirrors a guard already present in the sibling `fetchAioCycles`. Three additional warnings were found: a UI rendering conflict in `AioCycleDetailPage`, a missing React-hooks dependency that the project's Biome config will flag, and an in-place mutation of React Query–cached data. One informational item concerns a test mock mismatch that currently passes only due to Vitest module-graph hoisting.

---

## Critical Issues

### CR-01: Infinite loop when `maxResults` is 0 or absent in `fetchAioTestRunsForCycle` pagination

**File:** `taskflow/src/services/aio/issue-runs.ts:165-169`

**Issue:** After receiving a non-final page (`data.isLast` is `false`), the function advances the cursor with `startAt += data.maxResults` (line 169) without guarding against `maxResults` being `0` or `undefined`. If the AIO API returns `maxResults: 0` (which can happen on an empty or misconfigured page) while `isLast` is `false`, `startAt` is never incremented and the same request fires forever. If `maxResults` is absent (undefined), `startAt` becomes `NaN` and subsequent requests use `?startAt=NaN`, which is an invalid query parameter that the server may treat as 0 — producing the same loop.

The sibling function `fetchAioCycles` already has the correct guard at line 85:
```typescript
if (data.isLast || data.maxResults <= 0) return allCycles;
```
`issue-runs.ts` is missing the equivalent check.

**Fix:** Apply the same guard before advancing `startAt`:
```typescript
// issue-runs.ts, replace lines 165-170
if (data.isLast || !data.maxResults || data.maxResults <= 0) {
  await resolveDefectsForRuns(baseUrl, token, allRuns);
  return allRuns;
}
startAt += data.maxResults;
continue;
```

---

## Warnings

### WR-01: `ErrorState` and `AioCycleDetailSkeleton` can render simultaneously

**File:** `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx:233-256`

**Issue:** The error block (line 233) and the skeleton block (line 252) are two independent conditionals with no mutual exclusion. When `cycleQuery` errors while `runsQuery` is still loading, both conditions are true at the same time:

- Line 233 is true: `cycleQuery.isError` is `true`, and `!cycleQuery.data && !runsQuery.data` is `true`.
- Line 252 is true: `runsQuery.isLoading` is `true`.

The user sees both an error banner and a skeleton in the same viewport simultaneously — a broken UI state.

**Fix:** Check for error first and return early, or make the skeleton conditional explicit about the no-error path:
```tsx
{/* Error block — rendered independently, but only when NOT loading */}
{(cycleQuery.isError || runsQuery.isError) &&
  !cycleQuery.data &&
  !runsQuery.data &&
  !cycleQuery.isLoading &&
  !runsQuery.isLoading && (
    <div className="flex-1 overflow-auto">
      <div className="p-4">
        <ErrorState ... />
      </div>
    </div>
  )}

{/* Skeleton block — rendered only when no error state is active */}
{!cycleQuery.isError && !runsQuery.isError &&
  (showSkeleton || cycleQuery.isLoading || runsQuery.isLoading) ? (
  ...
) : ...}
```

---

### WR-02: Missing `expandedFolder` in `useEffect` dependency array triggers Biome `useExhaustiveDependencies` warning

**File:** `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx:125-130`

**Issue:** The `useEffect` callback reads `expandedFolder` (line 126) but the dependency array only contains `[data]` (line 130). The project's Biome config has `"useExhaustiveDependencies": "warn"`, so this will produce a lint warning on every CI run. Beyond the lint noise, the stale-closure risk is real: if React batches a `data` update with an `expandedFolder` update in the same render cycle, the effect fires with a stale value of `expandedFolder`.

```typescript
// Current — missing expandedFolder
useEffect(() => {
  if (data && data.length > 0 && expandedFolder === null) {
    const first = groupCyclesByFolder(data).keys().next().value;
    setExpandedFolder(first ?? null);
  }
}, [data]); // <-- expandedFolder missing
```

**Fix:** Add `expandedFolder` to the dependency array. The `expandedFolder === null` guard already prevents re-running after the user has selected a folder, so there is no behaviour change:
```typescript
}, [data, expandedFolder]);
```

---

### WR-03: `resolveDefectsForRuns` mutates React Query–cached objects in place

**File:** `taskflow/src/services/aio/issue-runs.ts:187-200`

**Issue:** `resolveDefectsForRuns` directly sets `run.defects = ...` on objects that have already been pushed into `allRuns` (line 164/166). When React Query caches the returned array, the cached objects are the same references. Any subsequent code that reads from the React Query cache before `resolveDefectsForRuns` completes will see `defects: []` (the initialised value from `normalizeTestRun`). If React Query's background refetch returns the same result and React Query performs a shallow equality check, the mutation bypasses React Query's change-detection, meaning subscribers may not re-render even after defects are resolved on a refetch.

**Fix:** Build the resolved defects before constructing the returned array, or return a new object from resolution:
```typescript
async function resolveDefectsForRuns(
  baseUrl: string,
  token: string,
  runs: AioTestRun[],
): Promise<AioTestRun[]> {
  return Promise.all(
    runs.map(async (run) => {
      const ids = run.jiraDefectIDs ?? [];
      if (ids.length === 0) return run;
      const defects = await resolveJiraDefectKeys(baseUrl, token, ids);
      return { ...run, defects };
    }),
  );
}
```
Then update the two call sites to use the returned array:
```typescript
// line 161-162
const resolvedRuns = await resolveDefectsForRuns(baseUrl, token, runs);
return resolvedRuns;
// line 165-167
const resolvedRuns = await resolveDefectsForRuns(baseUrl, token, allRuns);
return resolvedRuns;
```

---

## Info

### IN-01: Tests mock `apiFetch` but production code calls `aioFetch` — passes only via Vitest module hoisting

**File:** `taskflow/src/services/aio/cycles.test.ts:3-8` / `taskflow/src/services/aio/issue-runs.test.ts:3-11`

**Issue:** Both test files mock `../../lib/apiFetch` directly (`vi.mock('../../lib/apiFetch', ...)`), but neither `cycles.ts` nor `issue-runs.ts` imports `apiFetch` directly — they import `aioFetch` from `./client`, which internally calls `apiFetch`. The tests work today because Vitest's module graph replaces `apiFetch` everywhere including inside `client.ts`. However, the mock target is one abstraction layer removed from what the tests claim to be testing (`fetchAioCycles`, `fetchAioTestRunsForCycle`). If `client.ts` is ever refactored to not use `apiFetch` (e.g., replaced with `fetch` directly or a different wrapper), these tests will stop intercepting requests without any compile-time error, producing false-pass results.

**Fix:** Either mock `./client` instead:
```typescript
vi.mock('./client', () => ({ aioFetch: vi.fn() }));
const mockedAioFetch = vi.mocked(aioFetch);
```
Or add a comment at the mock site explaining the transitive dependency to prevent future confusion.

---

_Reviewed: 2026-05-14T20:01:45Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
