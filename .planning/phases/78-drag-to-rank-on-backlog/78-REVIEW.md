---
phase: 78-drag-to-rank-on-backlog
reviewed: 2026-06-04T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - taskflow/src/routes/dashboard/BacklogPage.tsx
  - taskflow/src/routes/dashboard/BacklogRow.tsx
  - taskflow/src/routes/dashboard/backlogDragHelpers.ts
  - taskflow/src/services/jira/rank.ts
  - taskflow/src/services/jira/rank-api.ts
  - taskflow/src/services/jira.ts
  - taskflow/src/components/ui/confirm-sprint-move-dialog.tsx
findings:
  critical: 1
  warning: 5
  info: 4
  total: 10
status: resolved
resolved: 2026-06-04T00:00:00Z
resolution_note: >-
  CR-01, WR-01, WR-02, WR-03, WR-05 fixed and tested. WR-04 (sibling mutation
  cancelQueries) and IN-01..IN-04 deferred — out of the dnd/rank fix scope for
  this pass (WR-04 touches the flag/sprint-membership mutations, the info items
  are dead-code/doc cleanups). npm run check clean; 806 dashboard+jira tests green.
---

# Phase 78: Code Review Report

**Reviewed:** 2026-06-04
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Reviewed the Phase 78 drag-to-rank implementation: dnd-kit wiring (`BacklogPage`/`BacklogRow`), pure drag helpers, the LexoRank calculator, the rank PUT service, the barrel export, and the confirm dialog's `cancelLabel` prop.

The LexoRank arithmetic (`rank.ts`) is the highest-risk area and I traced it against ~20 edge cases (cross-bucket, adjacent-gap guard, repeated midpoints, near-zero/near-max boundaries, insert-before/after-all). The documented cases are correct — the BigInt base-36 conversion and the adjacent-gap `'i'` extension behave as intended. `rankIssueApi` is also a faithful clone of the established `apiFetch` convention.

The defect surface is in the **react-query optimistic-update lifecycle**. One BLOCKER: the intra-section rank mutation seeds `localOrder` in `onMutate` but **never clears it on success**, so a successful reorder leaves a permanent client-side sort override that desyncs the section from server data (new/removed issues land wrong, and an unstable `NaN` comparator can fire). The cross-section path correctly deletes its overrides — the intra path was simply not given the same cleanup. Several WARNINGs around 207-Multi-Status handling, a `NaN` sort comparator, `SortableContext` items/filtered-rows mismatch, and missing `cancelQueries` on the sibling membership mutations round out the report.

The passing 439-test suite does **not** cover the success-path `localOrder` cleanup — `BacklogPage.rank.test.ts` calls `rankIssueApi` directly and never drives the real mutation handler, so this bug is invisible to CI.

## Critical Issues

### [RESOLVED] CR-01: Intra-section rank success never clears `localOrder` — permanent stale sort override

> **Fixed (2026-06-04):** Added `rankMutation.onSuccess` that deletes the section's `localOrder` entry, mirroring `confirmDragMove` (delete before the `onSettled` `invalidateGhBacklogData`), so the reconciled server order takes over without reintroducing the D-08/RANK-05 flicker.

**File:** `taskflow/src/routes/dashboard/BacklogPage.tsx:871-912` (mutation) and `:1264-1275` (render consumer)

**Issue:** `rankMutation.onMutate` writes the new order into `localOrder` (line 894). On **failure** `onError` restores it (line 903), and on **success** nothing clears it. `onSettled` only flips `isDraggingRef` and invalidates the query (lines 908-911) — it does not delete the `localOrder` entry. Contrast `confirmDragMove`, which explicitly deletes both section overrides on success (lines 1213-1218).

Because `renderSection` permanently re-sorts `displayIssues` by `localOrder.get(sectionId)` whenever an entry exists (lines 1264-1273), after the very first successful intra-section drag the affected section is pinned to a client-side order forever (until an aborted drag calls `restorePreDragOrder`, or unmount). Concrete consequences after a successful reorder:

- A subsequently-fetched **new** issue in that section is not present in `orderedKeys`, so its index resolves to `Infinity` and it is forced to the bottom of the section regardless of its true server rank.
- A second server-driven rank correction (or any reorder from another client) is ignored — the stale `localOrder` wins.
- Combined with an active filter, the `Infinity - Infinity = NaN` comparator (see WR-02) produces an undefined sort.

**Fix:** Clear the section's `localOrder` entry on success so the reconciled server order takes over, mirroring `confirmDragMove`:
```ts
const rankMutation = useMutation({
  // ...mutationFn, onMutate, onError unchanged...
  onSuccess: (_data, vars) => {
    setLocalOrder((prev) => {
      const next = new Map(prev);
      next.delete(vars.sectionId);
      return next;
    });
  },
  onSettled: () => {
    isDraggingRef.current = false;
    if (boardId != null) invalidateGhBacklogData(queryClient, boardId);
  },
});
```
(Deleting in `onSuccess` before the `onSettled` invalidation lets the refetched server order render cleanly.)

## Warnings

### [RESOLVED] WR-01: Rank PUT treats 207 Multi-Status as success — failed rank shows no error, no rollback

> **Fixed (2026-06-04):** `rankIssueApi` now returns only on 204, throws `ApiError` on 401/403, inspects 207 bodies and throws `Rank partially failed (207)` when any entry status is >= 400, and throws on any other non-ok status. Covered by `src/services/jira/__tests__/rank-api.test.ts`.

**File:** `taskflow/src/services/jira/rank-api.ts:44-49`

**Issue:** `Jira PUT /rest/agile/1.0/issue/rank` returns **204** on full success but **207 Multi-Status** when one or more issues could not be ranked (per-issue errors in the response body). The guard `if (!response.ok && response.status !== 204)` treats every 2xx — including 207 — as success, so a rejected rank silently "succeeds": no `ApiError`, no `onError` rollback, no banner. The optimistic order sticks while the server never applied it.

**Fix:** Only treat 204 as success; inspect 207 bodies:
```ts
if (response.status === 204) return;
if (response.status === 401 || response.status === 403) {
  throw new ApiError('Failed to rank issue', response.status, 'jira');
}
if (response.status === 207) {
  const body = await response.json().catch(() => null);
  const failed = body?.entries?.some((e: { status: number }) => e.status >= 400);
  if (failed) throw new Error('Rank partially failed (207)');
  return;
}
if (!response.ok) throw new Error(`Failed to rank issue: ${response.status}`);
```

### [RESOLVED] WR-02: `NaN` sort comparator when `localOrder` contains none of the filtered keys

> **Fixed (2026-06-04):** Extracted a pure `sortByKeyOrder` helper (`backlogDragHelpers.ts`) that ranks unknown keys with `Number.MAX_SAFE_INTEGER` and breaks ties on `key.localeCompare` — a total, deterministic order with no `NaN`. `displayIssues` now uses it. Covered by new `sortByKeyOrder` tests.

**File:** `taskflow/src/routes/dashboard/BacklogPage.tsx:1266-1272`

**Issue:** `displayIssues` sorts with `(ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi)`. When both keys are absent from `orderedKeys` the comparator returns `Infinity - Infinity = NaN`, which is an invalid (non-total-order) comparator and yields an implementation-defined, unstable ordering. This is reachable whenever a `localOrder` override exists but the currently-rendered (filtered) issues are all outside it — e.g. a stale override (CR-01) plus an active filter, or new issues fetched mid-override.

**Fix:** Use a tie-break that never produces `NaN`:
```ts
const rank = (k: string) => {
  const i = orderedKeys.indexOf(k);
  return i === -1 ? Number.MAX_SAFE_INTEGER : i;
};
const displayIssues = orderedKeys
  ? [...filteredIssues].sort((a, b) => rank(a.key) - rank(b.key) || a.key.localeCompare(b.key))
  : filteredIssues;
```

### [RESOLVED] WR-03: `SortableContext items` use unfiltered issue keys while only filtered rows render

> **Fixed (2026-06-04):** `sortableItems` now derives from `displayIssues.map(i => i.key)` (the rendered filtered+ordered set), so dnd-kit's index math lines up with the DOM. RANK-01 preserved (equals `filteredIssues` with no override). Covered by the `sortableItems derivation` tests.

**File:** `taskflow/src/routes/dashboard/BacklogPage.tsx:1275` (`sortableItems = orderedKeys ?? issues.map(...)`) vs `:1266` (`displayIssues` is `applyFilters(issues)`)

**Issue:** When no drag override is set and a filter is active, `sortableItems` lists every issue key in the section (`issues.map(i => i.key)`), but `VirtualizedBacklogTable` renders only `displayIssues` (the filtered subset). dnd-kit's sortable index math (`verticalListSortingStrategy`) is driven by `items`, so it computes positions against rows that are not in the DOM. The result is mis-aligned drag transforms / drop indices whenever the user reorders a filtered list. The intended order source should be the rendered set.

**Fix:** Derive `sortableItems` from the rendered rows:
```ts
const sortableItems = displayIssues.map((i) => i.key);
```
This also keeps RANK-01 (server order on load) intact because `displayIssues === filteredIssues` when no override is set.

### [DEFERRED] WR-04: Sibling cache mutations skip `cancelQueries`, can be clobbered by a focus refetch mid-flight

> **Deferred (2026-06-04):** Out of the dnd/rank fix scope — touches `handleToggleFlag`/`confirmMoveToSprint`/`confirmMoveToBacklog`, the flag/sprint-membership mutations, not the rank surface. Tracked for a follow-up pass.

**File:** `taskflow/src/routes/dashboard/BacklogPage.tsx:758-776` (`handleToggleFlag`), `:798-831` (`confirmMoveToSprint`), `:833-860` (`confirmMoveToBacklog`)

**Issue:** These three write the same `['gh-backlog', boardId]` cache optimistically but, unlike `rankMutation.onMutate` and `confirmDragMove`, none call `queryClient.cancelQueries({ queryKey: cacheKey })` before the optimistic `setQueryData`. A background/focus refetch that resolves between the optimistic write and `invalidateGhBacklogData` will overwrite the optimistic state with stale server data, producing a visible flicker / snap-back — the exact failure mode D-08 was added to prevent for ranking. They share the cache with the new rank code, so the inconsistency is now user-visible side-by-side.

**Fix:** Add `await queryClient.cancelQueries({ queryKey: cacheKey });` immediately before each optimistic `setQueryData`, matching the rank/cross-section path.

### [RESOLVED] WR-05: Cross-section confirm dialog has no pending-guard — double-click can double-fire the move

> **Fixed (2026-06-04):** `confirmDragMove` now early-returns when `dragMoveInFlightRef.current` is set (synchronous re-entry guard, since `setPendingDragMove` flushes async) and drives a `dragMovePending` state into the dialog's `isPending` (disabled "Moving..." button). The flag is released in a `finally` (and on the no-token path).

**File:** `taskflow/src/routes/dashboard/BacklogPage.tsx:1457-1469` and `confirmDragMove` `:1125-1128`

**Issue:** The drag-confirm `ConfirmSprintMoveDialog` passes `onConfirm={() => void confirmDragMove()}` with no `isPending`. `confirmDragMove` does call `setPendingDragMove(null)` first (line 1128), but state flushes asynchronously; a fast double-click on "Confirm" can invoke `confirmDragMove` twice against the same `pendingDragMove`, firing two membership PUTs + two rank PUTs. The button is never disabled.

**Fix:** Track a pending flag and pass `isPending` to disable the confirm button (the dialog already supports `isPending`, line 19/48), and/or early-return in `confirmDragMove` when already running.

## Info

### IN-01: `rankIssueApi` redundant `204` check

**File:** `taskflow/src/services/jira/rank-api.ts:44`

**Issue:** `!response.ok && response.status !== 204` — `response.ok` is already true for 204, so the `&& status !== 204` clause is unreachable. Harmless, but obscures the 207 gap (see WR-01). Folding into the explicit-status handling from WR-01 removes it.

### IN-02: `rankIssue` has no guard for `before >= after` (caller-misuse)

**File:** `taskflow/src/services/jira/rank.ts:21-38`

**Issue:** When called with inverted neighbours (`before` ranks after `after`, or `before === after`) the function returns a syntactically valid but logically meaningless rank (verified: `rankIssue('0|abc:','0|abc:')` → `'0|abci:'`, not between). Current callers always pass a valid ordered pair so this is latent, but an assertion or documented precondition would prevent a future caller from silently corrupting order.

**Fix:** Document the `before < after` precondition in the JSDoc, or add a dev-only invariant check.

### IN-03: `VirtualizedBacklogTable` carries fully-dead virtualization machinery

**File:** `taskflow/src/routes/dashboard/BacklogPage.tsx:141-152, 210-229`

**Issue:** `const useVirtual = false` is a hardcoded constant, making `rowVirtualizer`, `virtualItems`, the `useVirtual ? ... : ...` branches, and the per-row inline `style.position/top/left/...` writer (lines 158-168) all dead code. It is retained intentionally (the comment explains `position:absolute` on `<tr>` is broken) but it is now a misleading ~60 lines that imply virtualization is live. Consider deleting the dead branch and renaming the component, or gating it behind a clearly-unreachable `if (false)` with a single comment.

### IN-04: `_ref` forwarded ref is ignored; `setNodeRef` owns the row ref

**File:** `taskflow/src/routes/dashboard/BacklogRow.tsx:170-192, 266, 289`

**Issue:** `BacklogRow` is a `forwardRef<HTMLTableRowElement>` but the `_ref` arg is discarded — both `<tr>` paths bind `ref={setNodeRef}` (dnd-kit). The parent's `rowRefs` map (used for J/K scroll-into-view) is populated via a different callback ref in `renderRow` (lines 158-172), so the forwarded ref is genuinely unused. Not a bug, but the `forwardRef` wrapper is now vestigial and the `_ref` underscore hides that the contract is unfulfilled. Either consume `_ref` (compose with `setNodeRef`) or drop `forwardRef`.

---

_Reviewed: 2026-06-04_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
