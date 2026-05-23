---
phase: 65-tech-debt-cleanup
reviewed: 2026-05-23T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - taskflow/src/components/app/Sidebar.test.tsx
  - taskflow/src/lib/aioUtils.test.ts
  - taskflow/src/lib/aioUtils.ts
  - taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx
  - taskflow/src/routes/dashboard/AioCycleDetailPage.tsx
  - taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx
  - taskflow/src/routes/worklogs/WorklogsPage.test.tsx
  - taskflow/src/routes/worklogs/WorklogsPage.tsx
  - taskflow/src/services/aio/cycles.ts
  - taskflow/src/services/aio/types.ts
  - taskflow/src/services/tempo/types.ts
  - taskflow/src/stores/tempo-filters.store.ts
findings:
  critical: 3
  warning: 6
  info: 4
  total: 13
status: issues_found
---

# Phase 65: Code Review Report

**Reviewed:** 2026-05-23
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 65 is a tech-debt cleanup phase covering AIO TCMS integration, Tempo worklog viewer, and supporting stores. The code is generally well-structured with consistent patterns across files. However, three correctness bugs were found — two that silently produce wrong data in the UI (infinite pagination loop, double-counted worklog hours) and one that leaks state between tests. Additionally, six warnings cover quality issues including shared mutable module state, a missing `await`, hardcoded status IDs that duplicate the runtime map, and several edge-case gaps.

---

## Critical Issues

### CR-01: Infinite loop when AIO pagination returns `maxResults: 0` with more items

**File:** `taskflow/src/services/aio/cycles.ts:102`

**Issue:** The pagination termination condition is `data.isLast || data.maxResults <= 0`. If the API returns a page with `maxResults: 0` but `isLast: false` (e.g. a misconfigured response or a zero-total-results envelope that still wraps data), this branch returns the partial `allCycles` array, silently dropping any subsequent pages. Conversely, if `isLast` is never `true` and `maxResults` is always > 0 (the common case), the `startAt` increment advances by `data.maxResults` each iteration — but the path variable is reconstructed in the next iteration using `startAt`. If the server always returns a page-size equal to `maxResults` but omits `isLast`, `startAt` never exceeds the total and the loop runs forever, exhausting memory.

The real risk: `startAt += data.maxResults` means "advance by page-size" rather than "advance by items received". If the server returns fewer items than `maxResults` on the final page but does not set `isLast: true`, the loop will re-request the same offset repeatedly, producing an infinite loop.

**Fix:** Advance by the actual number of items received, and treat a short page (items received < maxResults) as the terminal condition:

```ts
const items = (data.items as unknown as RawCycle[]) ?? [];
allCycles.push(...items.map((r) => normalizeCycle(r, projectKey)));
// Terminate if: explicitly last, zero page size, or short page (server has no more)
if (data.isLast || data.maxResults <= 0 || items.length < data.maxResults) return allCycles;
startAt += items.length;
```

---

### CR-02: Worklog hours double-counted for subtasks in hierarchy table

**File:** `taskflow/src/routes/worklogs/WorklogsPage.tsx:609-611`

**Issue:** When a worklog is logged against a subtask, the code propagates its `secs` up to both the `storyNode.dayMap` and `epicNode.dayMap` (lines 610-611). But the `storyNode.entries.push(w)` at line 607 never runs for the subtask path — only `storyNode.subtasks.get(issueKey).entries.push(w)` runs. This means `epicNode.dayMap` and `storyNode.dayMap` include the subtask time, which is correct.

However, the `epicTotal` in the JSX (line 1046) is computed from `epicNode.dayMap` — which includes both story-logged time AND subtask-logged time. And each `storyNode.dayMap` shown in the story row already includes subtask time. The story row `storyTotal` at line 1125 sums `storyNode.dayMap` which was already augmented with subtask seconds. If a user logs time directly on both a story AND its subtask, the story's dayMap will contain its own entries' time plus all subtask entries' time, while the epic's dayMap will contain the sum of all story dayMaps (which themselves already include subtask time). This means the epic total is not double-counted — but the story row total is overstated whenever the worklog is at the subtask level and the story row also has direct entries, since `storyNode.entries` holds only story-direct worklogs while `storyNode.dayMap` holds story+subtask time.

The more concrete bug: on lines 1158-1160, the `cellEntries` for a story cell is filtered by `w.issue.key === storyKey` — this will return only worklogs logged directly against the story, not its subtasks. But the `totalSeconds` prop passed to `WorklogCellPopover` for that cell is `storyNode.dayMap.get(day)` — which includes subtask time. So the cell displays a total that does not match the entries listed in the popover. This is a data-integrity bug visible to the user.

**Fix:** The `cellEntries` filter for story cells should not include subtask worklogs as the hours shown, OR the `totalSeconds` passed must match what the entries list shows. The cleanest fix is to use `storyNode.entries` for both (direct only), or collect all entries in the subtree and pass them together:

```tsx
// Option A: make story cell total match only direct entries (not subtasks)
const directStoryTime = storyNode.entries
  .filter((w) => w.dateStarted === day)
  .reduce((sum, w) => sum + w.timeSpentSeconds, 0);

// Option B: collect all subtask entries under this story for this day
const allStoryEntries = [
  ...storyNode.entries.filter((w) => w.dateStarted === day),
  ...[...storyNode.subtasks.values()]
    .flatMap((sub) => sub.entries)
    .filter((w) => w.dateStarted === day),
];
```

---

### CR-03: Module-level `runtimeAioStatusMap` leaks state across test files

**File:** `taskflow/src/lib/aioUtils.ts:65-66`

**Issue:** `runtimeAioStatusMap` is a module-level singleton. Vitest runs test files in the same process (unless explicitly isolated). The `aioUtils.test.ts` suite calls `initializeAioStatusMap` multiple times with different mock data. The `AioCycleDetailPage.test.tsx` suite also calls `initializeAioStatusMap` in `beforeEach`. If Vitest runs these files in the same worker, the map's state from one test suite will bleed into another — and test ordering will affect results.

The `aioUtils.test.ts` test at line 95 ("falls back to empty map when fetchAioProjectConfig throws") sets `runtimeAioStatusMap = {}`. If this test runs *before* `AioCycleDetailPage.test.tsx` tests that call `initializeAioStatusMap`, those tests will re-initialize correctly. But if the test files run in a different order or if Vitest's module cache is shared, tests expecting `normalizeStatusById(53)` to return `'pass'` can see `'notRun'` instead.

This is a design-level issue: module-level mutable state should never be shared across test files without explicit reset.

**Fix:** Export a `resetAioStatusMap` function for test use only, or move the map inside a class/context. For test files, call `resetAioStatusMap()` in `afterEach`.

```ts
// In aioUtils.ts — add:
export function _resetAioStatusMapForTests(): void {
  runtimeAioStatusMap = {};
}
```

Each test file's `beforeEach` should then call this before `initializeAioStatusMap`.

---

## Warnings

### WR-01: `collectSubtreeIDs` silently returns `[rootID]` when ID is not found in tree

**File:** `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx:75-92`

**Issue:** When `rootID` is not found anywhere in the tree, `collectSubtreeIDs` falls through to `return [rootID]` at line 91. This means an invalid folder ID is treated as a valid single-item selection, and the API call `fetchAioCyclesWithDetail` will be invoked with that ID. The caller has no way to distinguish "folder with no children" from "folder ID not found". If the tree changes between renders (re-fetch), a previously valid `selectedFolderID` could become stale and silently produce a wrong API call.

**Fix:** Return an empty array (or `null`) to signal "not found", and guard the `aioGate` in the cycle query:

```ts
// Change the fallback:
return []; // not [rootID] — caller must handle empty as "not found"
```

---

### WR-02: `handleSaveFilter` uses `Math.random()` for ID generation — not cryptographically unique

**File:** `taskflow/src/routes/worklogs/WorklogsPage.tsx:689`

**Issue:** The filter ID is generated as `Date.now().toString(36) + Math.random().toString(36).slice(2)`. `Date.now()` has millisecond precision. If two `handleSaveFilter` calls happen in the same millisecond (unlikely in practice, but possible in rapid test automation or scripted use), the `Date.now()` portion collides, and `Math.random()` provides only ~52 bits of entropy. More critically, `Math.random()` is not seeded cryptographically and can produce collisions in environments with weak RNG. A collision silently replaces an existing filter's ID used in `activeFilterId` state, potentially causing the wrong filter to appear active.

**Fix:** Use `crypto.randomUUID()` which is available in all modern environments including Tauri's WebView:

```ts
const newId = crypto.randomUUID();
```

---

### WR-03: `filteredPeople` is an unused alias — dead assignment

**File:** `taskflow/src/routes/worklogs/WorklogsPage.tsx:735`

**Issue:** `const filteredPeople = people;` is assigned at line 735 but the filtering logic it implies is completely absent — it is just a passthrough alias. The variable name implies filtering has been applied, but no filter is applied. This is misleading: it suggests future filtering logic was intended but never implemented, and leaves a stale variable name in the codebase.

**Fix:** Remove the alias and use `people` directly in the JSX at line 914 (`filteredPeople.map` → `people.map`), or implement the intended filter if one was planned.

---

### WR-04: Missing `await` on `queryClient.invalidateQueries` inside error retry handler

**File:** `taskflow/src/routes/dashboard/AioCycleDetailPage.tsx:823-829`

**Issue:** The `onRetry` callback in the `ErrorState` calls `void queryClient.invalidateQueries(...)` twice using the `void` operator. While `void` silences the unhandled-promise warning, these two invalidations are fired without sequential ordering. If the second invalidation depends on the first completing (they share the same AIO credentials and base URL), a race condition exists. Furthermore, if `invalidateQueries` throws, the error is silently swallowed by `void`.

This is a lower-severity race (unlikely in practice) but the `void` pattern is used inconsistently — lines 471-476 in `AioProjectOverviewPage.tsx` use `queryClient.invalidateQueries` without `void` or `await` in similar retry callbacks.

**Fix:** Use `Promise.all` to fire both invalidations and handle errors:

```ts
onRetry={() => {
  void Promise.all([
    queryClient.invalidateQueries({ queryKey: ['aio', jiraBaseUrl, 'cycle-detail', projectKey, cycleKey] }),
    queryClient.invalidateQueries({ queryKey: ['aio', jiraBaseUrl, 'runs', projectKey, cycleKey] }),
  ]);
}}
```

---

### WR-05: `TESTCASE_STATUS_MAP` in `cycles.ts` duplicates the runtime status map and will diverge

**File:** `taskflow/src/services/aio/cycles.ts:335-342`

**Issue:** `TESTCASE_STATUS_MAP` is a hardcoded `Record<number, string>` mapping numeric status IDs to chip status strings. It is used in `chipStatusFromId()` at line 344 to convert raw `testRunStatusID` values from the `testcasewithrun/paged` response. The IDs 51–55 and 901 are hardcoded here.

The runtime status map in `aioUtils.ts` is designed as a single source of truth for this exact mapping (CLEAN-07), populated dynamically from the `/config` endpoint. However, `fetchAioCycleTestCasesWithRuns` never calls `normalizeStatusById` — it uses the hardcoded map. If the AIO instance has custom status IDs outside 51–55/901, those IDs will be mapped to `'NOT_EXECUTED'` by the hardcoded fallback, silently misclassifying test run status in the runs table while the progress bar (which uses the runtime map) shows a different value.

This creates a split-brain: the progress bar uses the dynamic runtime map; the runs table uses a hardcoded static map.

**Fix:** `fetchAioCycleTestCasesWithRuns` should return the raw `testRunStatusID` as the `status` field, and let the component call `normalizeStatusById(Number(run.status))` for display — the same pattern used for progress bar counts. This eliminates the hardcoded map entirely.

---

### WR-06: `AioCycleDetailPage.test.tsx` — `mockBreadcrumbPush` and its `vi.mock` are declared after they are used

**File:** `taskflow/src/routes/dashboard/AioCycleDetailPage.test.tsx:867-886`

**Issue:** `mockBreadcrumbPush` is declared at line 867, and the `vi.mock('@/stores/breadcrumb.store', ...)` that closes over it appears at line 869 — both are placed after the `describe('AioCycleDetailPage', ...)` block and after the live import of `AioCycleDetailPage` at line 145.

Vitest hoists `vi.mock()` calls to the top of the file. However, the factory function references `mockBreadcrumbPush`, which is a `const` declared at line 867. Because the `vi.mock` factory is hoisted but `mockBreadcrumbPush` is not a `let` at module level — it's a `const` after the first `describe` block — the factory will capture `undefined` when it executes at hoist time, causing `mockBreadcrumbPush` to be `undefined` inside the mock.

This means all tests in the `'Executions tab — clickable rows'` describe block and `AIOC-03-D` that assert `expect(mockBreadcrumbPush).toHaveBeenCalledWith(...)` may pass or fail nondeterministically depending on Vitest's hoisting strategy.

**Fix:** Move `const mockBreadcrumbPush = vi.fn();` and its `vi.mock` to the top of the file alongside the other mock declarations (before the first `describe` block), following the same pattern as `mockPinnedKeys`/`mockTogglePin` on lines 46-50.

---

## Info

### IN-01: `STATUS_TYPE_MAP` is defined in both `aioUtils.ts` and `AioProjectOverviewPage.tsx`

**File:** `taskflow/src/lib/aioUtils.ts:57-63` and `taskflow/src/routes/dashboard/AioProjectOverviewPage.tsx:33-39`

**Issue:** `STATUS_TYPE_MAP` (the `statusType` string → canonical key mapping) is defined as a module-level constant in both files with identical content. `AioProjectOverviewPage.tsx` uses its own local copy to build a per-render `statusMap` via `buildStatusMap`. This is the duplication that CLEAN-07 was supposed to address, but `AioProjectOverviewPage` was not updated to import from `aioUtils`.

**Fix:** `AioProjectOverviewPage.tsx` should import and reuse the `STATUS_TYPE_MAP` from `aioUtils.ts`, or expose a `buildStatusMapFromConfig(statuses)` helper from `aioUtils.ts` that both consumers can import.

---

### IN-02: `Sidebar.test.tsx` — duplicate test ID `'AION-01'` on two different test cases

**File:** `taskflow/src/components/app/Sidebar.test.tsx:110` and `taskflow/src/components/app/Sidebar.test.tsx:124`

**Issue:** Both `it('AION-01: Testing section is visible when aioEnabled is true', ...)` and `it('AION-01: Testing section is absent when aioEnabled is false', ...)` carry the same test ID prefix `AION-01`. This makes test reports ambiguous when filtering by test ID.

**Fix:** The second test should be `AION-02`.

---

### IN-03: `WorklogsPage.tsx` — `enumerateDays` manually constructs ISO date strings instead of using `.toISOString().slice(0, 10)`

**File:** `taskflow/src/routes/worklogs/WorklogsPage.tsx:122-127`

**Issue:** The loop body at lines 123-126 manually formats the date as:
```ts
`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
```
This is unnecessarily verbose. The file comment on line 114 explicitly documents the correct approach: "Uses `.toISOString().slice(0, 10)` — NEVER `toLocaleDateString()`". But the implementation does not follow its own documented pattern (though `toLocaleDateString` is correctly avoided). The manual construction is consistent with UTC because `getFullYear`/`getMonth`/`getDate` use local time, which could produce a different result than `toISOString().slice(0,10)` in UTC-ahead timezones at midnight.

**Fix:** Use the already-documented pattern consistently:
```ts
days.push(d.toISOString().slice(0, 10));
```
Note: `d` must be constructed as UTC midnight for this to be correct — the existing `new Date(\`${from}T00:00:00\`)` construction uses local time, so `toISOString()` would shift back. Either pin the construction to UTC (`new Date(\`${from}T00:00:00Z\`)`) or keep the manual local-time formatting. Document the choice explicitly.

---

### IN-04: `tempo-filters.store.ts` — `migrate` function is a no-op passthrough

**File:** `taskflow/src/stores/tempo-filters.store.ts:50`

**Issue:** The `migrate` function `(persisted, _version) => persisted as TempoFiltersState` does nothing — it returns the persisted state cast as the current type regardless of the stored version. If the `TempoFilter` shape changes in a future version, this migration will silently load stale data with the wrong shape, which will cause runtime errors or data loss when accessing missing fields.

**Fix:** Either implement version-aware migration logic, or document explicitly that v1 is the initial version with no migration needed and future migrations will be added here. A bare passthrough with an underscore-prefixed `_version` parameter suggests the migration logic was deferred rather than intentionally left minimal.

---

_Reviewed: 2026-05-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
